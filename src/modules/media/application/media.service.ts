import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { pool } from "modules/shared/infrastructure/database/drizzle";
import type { PoolClient, QueryResultRow } from "pg";
import sharp from "sharp";
import { uuidv7 } from "uuidv7";
import type {
	MediaDestination,
	MediaImage,
	ReserveUpload,
	UploadAuthorization,
} from "../domain/media.schemas";
import {
	MediaObjectTooLargeError,
	MediaStorageService,
} from "../infrastructure/s3/media-storage.service";
import { MediaHttpError } from "./media.errors";

const INPUT_LIMIT = 10 * 1024 * 1024;
const PIXEL_LIMIT = 20_000_000;
const ACCOUNT_LIMIT = 1024 * 1024 * 1024;
const ACTIVE_UPLOAD_LIMIT = 10;
const PUT_TTL_SECONDS = 300;
const COMPLETE_TTL_MINUTES = 15;

type MediaRow = QueryResultRow & {
	id: string;
	kind: MediaDestination["kind"];
	systemId: string | null;
	collectionId: string | null;
	recordId: string | null;
	fileName: string;
	alt: string;
	contentType: "image/webp";
	sizeBytes: number;
	width: number;
	height: number;
	createdAt: Date | string;
	updatedAt: Date | string;
	state?: string;
	userId?: string;
	bucket?: string;
	temporaryKey?: string;
	finalKey?: string | null;
	declaredContentType?: string;
	declaredSizeBytes?: number;
	checksumSha256?: string;
	completeBefore?: Date | string;
	uploadExpiresAt?: Date | string;
	expectedCoverMediaId?: string | null;
	processToken?: string | null;
	leaseUntil?: Date | string | null;
	attemptId?: string | null;
};

function noStorageError(): MediaHttpError {
	return new MediaHttpError(503, "Image storage is unavailable", 60);
}

function mediaImage(row: MediaRow): MediaImage {
	const destination =
		row.kind === "system-cover"
			? { kind: row.kind, id: row.systemId as string }
			: row.kind === "collection-cover"
				? { kind: row.kind, id: row.collectionId as string }
				: { kind: row.kind, id: row.recordId as string };
	return {
		id: row.id,
		destination,
		fileName: row.fileName,
		alt: row.alt,
		contentType: "image/webp",
		sizeBytes: Number(row.sizeBytes),
		width: Number(row.width),
		height: Number(row.height),
		createdAt: dateIso(row.createdAt),
		updatedAt: dateIso(row.updatedAt),
	};
}

function dateIso(value: Date | string): string {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function dateMillis(value: Date | string): number {
	return value instanceof Date ? value.getTime() : Date.parse(value);
}

async function begin(client: PoolClient): Promise<void> {
	await client.query("BEGIN");
}
async function commit(client: PoolClient): Promise<void> {
	await client.query("COMMIT");
}
async function rollback(client: PoolClient): Promise<void> {
	await client.query("ROLLBACK").catch(() => undefined);
}

@Injectable()
export class MediaService {
	private activeProcessors = 0;

	constructor(private readonly storage: MediaStorageService) {}

	async reserve(
		ownerId: string,
		input: ReserveUpload,
	): Promise<UploadAuthorization> {
		this.requireStorage();
		const id = uuidv7();
		const temporaryKey = `tmp/${ownerId}/${id}`;
		const now = Date.now();
		const uploadExpiresAt = new Date(now + PUT_TTL_SECONDS * 1000);
		const completeBefore = new Date(now + COMPLETE_TTL_MINUTES * 60_000);
		const client = await pool.connect();
		try {
			await begin(client);
			await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
				ownerId,
			]);
			await this.consumeRateLimit(client, ownerId, "upload", 30);
			if (!(await this.ownsDestination(client, ownerId, input.destination))) {
				throw new MediaHttpError(404, "Resource not found");
			}
			await this.lockDestination(client, input.destination);
			const expectedCoverMediaId =
				input.destination.kind === "record-image"
					? null
					: input.destination.expectedCoverMediaId;
			if (input.destination.kind !== "record-image") {
				const current = await this.currentCover(
					client,
					input.destination.kind,
					input.destination.id,
					true,
				);
				if (current !== expectedCoverMediaId)
					throw new MediaHttpError(
						409,
						"Cover changed; reload the current image",
					);
			}
			const active = await client.query<{ count: string }>(
				"SELECT count(*)::text AS count FROM media_assets WHERE user_id = $1 AND state IN ('pending','processing') AND complete_before > now()",
				[ownerId],
			);
			if (Number(active.rows[0]?.count ?? 0) >= ACTIVE_UPLOAD_LIMIT)
				throw new MediaHttpError(409, "Active image upload limit reached");
			const usage = await client.query<{ bytes: string }>(
				`SELECT COALESCE(sum(CASE WHEN state = 'ready' THEN output_size_bytes ELSE $2 END), 0)::text AS bytes
				 FROM media_assets WHERE user_id = $1 AND (state = 'ready' OR (state IN ('pending','processing') AND complete_before > now()))`,
				[ownerId, INPUT_LIMIT],
			);
			if (Number(usage.rows[0]?.bytes ?? 0) + INPUT_LIMIT > ACCOUNT_LIMIT)
				throw new MediaHttpError(409, "Image storage quota reached");
			if (input.destination.kind === "record-image") {
				const count = await client.query<{ count: string }>(
					"SELECT count(*)::text AS count FROM media_assets WHERE record_id = $1 AND (state = 'ready' OR (state IN ('pending','processing') AND complete_before > now()))",
					[input.destination.id],
				);
				if (Number(count.rows[0]?.count ?? 0) >= 10)
					throw new MediaHttpError(409, "Record image limit reached");
			}
			await client.query(
				`INSERT INTO media_assets
				 (id,user_id,kind,system_id,collection_id,record_id,expected_cover_media_id,bucket,file_name,declared_content_type,declared_size_bytes,checksum_sha256,alt,state,temporary_key,upload_expires_at,complete_before)
				 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14,$15,$16)`,
				[
					id,
					ownerId,
					input.destination.kind,
					input.destination.kind === "system-cover"
						? input.destination.id
						: null,
					input.destination.kind === "collection-cover"
						? input.destination.id
						: null,
					input.destination.kind === "record-image"
						? input.destination.id
						: null,
					expectedCoverMediaId,
					this.storage.bucket,
					input.fileName,
					input.contentType,
					input.sizeBytes,
					input.checksumSha256,
					input.alt,
					temporaryKey,
					uploadExpiresAt,
					completeBefore,
				],
			);
			await commit(client);
		} catch (error) {
			await rollback(client);
			throw error;
		} finally {
			client.release();
		}

		try {
			const signed = await this.storage.signPut(
				temporaryKey,
				input.contentType,
				input.checksumSha256,
			);
			await pool.query(
				"UPDATE media_assets SET upload_expires_at=$2 WHERE id=$1 AND state='pending'",
				[id, signed.expiresAt],
			);
			return {
				id,
				state: "pending",
				upload: {
					method: "PUT",
					url: signed.url,
					headers: signed.headers,
					expiresAt: signed.expiresAt.toISOString(),
				},
				completeBefore: completeBefore.toISOString(),
			};
		} catch {
			await this.removeReservation(id, ownerId);
			throw noStorageError();
		}
	}

	async complete(ownerId: string, id: string): Promise<MediaImage> {
		this.requireStorage();
		if (this.activeProcessors >= 2)
			throw new MediaHttpError(503, "Image processing capacity is full", 5);
		this.activeProcessors += 1;
		try {
			const claim = await this.claimProcessing(ownerId, id);
			if (claim.ready) return mediaImage(claim.row);
			if (
				!claim.token ||
				!claim.attemptId ||
				!claim.finalKey ||
				!claim.temporaryKey ||
				!claim.bucket
			)
				throw new MediaHttpError(404, "Resource not found");
			let original: Buffer;
			try {
				const head = await this.storage.head(claim.temporaryKey, claim.bucket);
				if (head.size < 1 || head.size > INPUT_LIMIT) {
					await this.removeReservation(id, ownerId);
					throw new MediaHttpError(413, "Image exceeds the input size limit");
				}
				if (head.size !== claim.declaredSizeBytes) {
					await this.removeReservation(id, ownerId);
					throw new MediaHttpError(
						422,
						"Image size does not match the reservation",
					);
				}
				original = await this.storage.readLimited(
					claim.temporaryKey,
					claim.bucket,
				);
			} catch (error) {
				if (error instanceof MediaHttpError) throw error;
				if (error instanceof MediaObjectTooLargeError) {
					await this.removeReservation(id, ownerId);
					throw new MediaHttpError(413, "Image exceeds the input size limit");
				}
				const status = (
					error as { $metadata?: { httpStatusCode?: number }; name?: string }
				)?.$metadata?.httpStatusCode;
				if (
					status === 404 ||
					(error as { name?: string })?.name === "NoSuchKey"
				) {
					await this.releaseAttempt(ownerId, id, claim.token, claim.finalKey);
					throw new MediaHttpError(
						409,
						"Upload not found; send the image and retry confirmation",
					);
				}
				await this.releaseAttempt(ownerId, id, claim.token, claim.finalKey);
				throw noStorageError();
			}

			if (original.byteLength !== claim.declaredSizeBytes) {
				await this.removeReservation(id, ownerId);
				throw new MediaHttpError(
					422,
					"Image size does not match the reservation",
				);
			}
			if (
				createHash("sha256").update(original).digest("base64") !==
				claim.checksumSha256
			) {
				await this.removeReservation(id, ownerId);
				throw new MediaHttpError(
					422,
					"Image checksum does not match the reservation",
				);
			}

			let output: Buffer;
			let width = 0;
			let height = 0;
			try {
				const decoder = sharp(original, {
					limitInputPixels: PIXEL_LIMIT,
					animated: true,
					failOn: "error",
				}).timeout({ seconds: 30 });
				const metadata = await decoder.metadata();
				const detectedType =
					metadata.format === "jpeg"
						? "image/jpeg"
						: metadata.format === "png"
							? "image/png"
							: metadata.format === "webp"
								? "image/webp"
								: null;
				if (
					!detectedType ||
					detectedType !== claim.declaredContentType ||
					(metadata.pages ?? 1) !== 1
				) {
					await this.removeReservation(id, ownerId);
					throw new MediaHttpError(415, "Image format is not supported");
				}
				if (
					!metadata.width ||
					!metadata.height ||
					metadata.width * metadata.height > PIXEL_LIMIT
				) {
					await this.removeReservation(id, ownerId);
					throw new MediaHttpError(
						422,
						"Image dimensions exceed the allowed limit",
					);
				}
				const result = await sharp(original, {
					limitInputPixels: PIXEL_LIMIT,
					failOn: "error",
				})
					.rotate()
					.webp({ quality: 85 })
					.toBuffer({ resolveWithObject: true });
				output = result.data;
				width = result.info.width;
				height = result.info.height;
				if (output.byteLength > INPUT_LIMIT) {
					await this.removeReservation(id, ownerId);
					throw new MediaHttpError(
						413,
						"Processed image exceeds the output size limit",
					);
				}
			} catch (error) {
				if (error instanceof MediaHttpError) throw error;
				await this.removeReservation(id, ownerId);
				throw new MediaHttpError(
					422,
					"Image is invalid or could not be decoded",
				);
			}

			let outputChecksum: string;
			try {
				outputChecksum = await this.storage.putValidated(
					claim.finalKey,
					output,
					claim.bucket,
				);
			} catch {
				await this.releaseAttempt(ownerId, id, claim.token, claim.finalKey);
				throw noStorageError();
			}
			try {
				return await this.publish(
					ownerId,
					id,
					{
						token: claim.token,
						attemptId: claim.attemptId,
						finalKey: claim.finalKey,
					},
					{ width, height, size: output.byteLength, outputChecksum },
				);
			} catch (error) {
				await this.releaseAttempt(ownerId, id, claim.token, claim.finalKey);
				throw error;
			}
		} finally {
			this.activeProcessors -= 1;
		}
	}

	async access(
		ownerId: string,
		id: string,
	): Promise<{ id: string; url: string; expiresAt: string }> {
		this.requireStorage();
		const result = await pool.query<MediaRow>(
			`SELECT ${this.imageColumns()} FROM media_assets m
			 WHERE m.id = $1 AND m.user_id = $2 AND ${this.destinationOwnershipSql("m")}`,
			[id, ownerId],
		);
		const row = result.rows[0];
		if (!row) throw new MediaHttpError(404, "Resource not found");
		if (row.state !== "ready")
			throw new MediaHttpError(409, "Image is not ready");
		if (!row.finalKey) throw new MediaHttpError(404, "Resource not found");
		try {
			const access = await this.storage.signGet(row.finalKey, row.bucket);
			return { id, url: access.url, expiresAt: access.expiresAt.toISOString() };
		} catch {
			throw noStorageError();
		}
	}

	async updateAlt(
		ownerId: string,
		id: string,
		alt: string,
	): Promise<MediaImage> {
		const client = await pool.connect();
		try {
			await begin(client);
			const result = await client.query<MediaRow>(
				`SELECT ${this.imageColumns()} FROM media_assets m WHERE m.id = $1 AND m.user_id = $2 FOR UPDATE`,
				[id, ownerId],
			);
			const row = result.rows[0];
			if (!row) {
				await commit(client);
				throw new MediaHttpError(404, "Resource not found");
			}
			if (row.state !== "ready")
				throw new MediaHttpError(409, "Image is not ready");
			if (row.alt !== alt) {
				await client.query(
					"UPDATE media_assets SET alt = $2, updated_at = now() WHERE id = $1",
					[id, alt],
				);
				await this.touchDestination(client, row);
				row.alt = alt;
				row.updatedAt = new Date();
			}
			await commit(client);
			return mediaImage(row);
		} catch (error) {
			await rollback(client);
			throw error;
		} finally {
			client.release();
		}
	}

	async remove(ownerId: string, id: string): Promise<void> {
		const client = await pool.connect();
		try {
			await begin(client);
			const result = await client.query<MediaRow>(
				`SELECT ${this.imageColumns()} FROM media_assets m WHERE m.id=$1 AND m.user_id=$2 FOR UPDATE`,
				[id, ownerId],
			);
			const row = result.rows[0];
			if (row?.state === "ready") await this.touchDestination(client, row);
			await client.query(
				"DELETE FROM media_assets WHERE id = $1 AND user_id = $2",
				[id, ownerId],
			);
			await commit(client);
		} catch (error) {
			await rollback(client);
			throw error;
		} finally {
			client.release();
		}
	}

	async cover(
		ownerId: string,
		kind: "system-cover" | "collection-cover",
		id: string,
	): Promise<{ image: MediaImage | null }> {
		const client = await pool.connect();
		try {
			const destination: MediaDestination = {
				kind,
				id,
				expectedCoverMediaId: null,
			};
			if (!(await this.ownsDestination(client, ownerId, destination)))
				throw new MediaHttpError(404, "Resource not found");
			const column = kind === "system-cover" ? "system_id" : "collection_id";
			const result = await client.query<MediaRow>(
				`SELECT ${this.imageColumns()} FROM media_assets m WHERE m.${column} = $1 AND m.user_id = $2 AND m.kind = $3 AND m.state = 'ready'`,
				[id, ownerId, kind],
			);
			return { image: result.rows[0] ? mediaImage(result.rows[0]) : null };
		} finally {
			client.release();
		}
	}

	async recordImages(
		ownerId: string,
		recordId: string,
	): Promise<{ items: MediaImage[] }> {
		const client = await pool.connect();
		try {
			const own = await client.query(
				"SELECT 1 FROM rpg_records r JOIN rpg_templates t ON t.id=r.template_id JOIN rpg_collections c ON c.id=t.collection_id JOIN rpg_systems s ON s.id=c.system_id WHERE r.id=$1 AND s.user_id=$2",
				[recordId, ownerId],
			);
			if (!own.rowCount) throw new MediaHttpError(404, "Resource not found");
			const result = await client.query<MediaRow>(
				`SELECT ${this.imageColumns()} FROM media_assets m WHERE m.record_id = $1 AND m.user_id = $2 AND m.state = 'ready' ORDER BY m.published_at ASC, m.id ASC`,
				[recordId, ownerId],
			);
			return { items: result.rows.map(mediaImage) };
		} finally {
			client.release();
		}
	}

	private async claimProcessing(
		ownerId: string,
		id: string,
	): Promise<{
		row: MediaRow;
		ready: boolean;
		token?: string;
		attemptId?: string;
		finalKey?: string;
		temporaryKey?: string;
		bucket?: string;
		declaredSizeBytes: number;
		checksumSha256: string;
		declaredContentType: string;
	}> {
		const client = await pool.connect();
		try {
			await begin(client);
			await this.consumeRateLimit(client, ownerId, "complete", 60);
			const result = await client.query<MediaRow>(
				`SELECT ${this.imageColumns()} FROM media_assets m WHERE m.id=$1 AND m.user_id=$2 FOR UPDATE`,
				[id, ownerId],
			);
			const row = result.rows[0];
			if (!row) {
				await commit(client);
				throw new MediaHttpError(404, "Resource not found");
			}
			if (row.state === "ready") {
				await commit(client);
				return {
					row,
					ready: true,
					declaredSizeBytes: 0,
					checksumSha256: "",
					declaredContentType: "",
				};
			}
			if (dateMillis(row.completeBefore as Date | string) <= Date.now()) {
				await client.query("DELETE FROM media_assets WHERE id=$1", [id]);
				await commit(client);
				throw new MediaHttpError(410, "Upload authorization expired");
			}
			if (
				row.state === "processing" &&
				row.leaseUntil &&
				dateMillis(row.leaseUntil as Date | string) > Date.now()
			) {
				const retry = Math.max(
					1,
					Math.ceil(
						(dateMillis(row.leaseUntil as Date | string) - Date.now()) / 1000,
					),
				);
				await commit(client);
				throw new MediaHttpError(
					409,
					"Image processing is already active",
					retry,
				);
			}
			const token = uuidv7();
			const attemptId = uuidv7();
			const finalKey = `images/${ownerId}/${id}/${attemptId}.webp`;
			await client.query(
				"INSERT INTO media_processing_attempts(attempt_id,media_id,object_key,lease_until) VALUES($1,$2,$3,now()+interval '60 seconds')",
				[attemptId, id, finalKey],
			);
			await client.query(
				"UPDATE media_assets SET state='processing',attempt_id=$2,process_token=$3,lease_until=now()+interval '60 seconds',final_key=$4,updated_at=now() WHERE id=$1",
				[id, attemptId, token, finalKey],
			);
			await commit(client);
			return {
				row,
				ready: false,
				token,
				attemptId,
				finalKey,
				temporaryKey: row.temporaryKey,
				bucket: row.bucket,
				declaredSizeBytes: Number(row.declaredSizeBytes),
				checksumSha256: row.checksumSha256 as string,
				declaredContentType: row.declaredContentType as string,
			};
		} catch (error) {
			await rollback(client);
			throw error;
		} finally {
			client.release();
		}
	}

	private async publish(
		ownerId: string,
		id: string,
		claim: { token: string; attemptId: string; finalKey: string },
		output: {
			width: number;
			height: number;
			size: number;
			outputChecksum: string;
		},
	): Promise<MediaImage> {
		const client = await pool.connect();
		try {
			await begin(client);
			const result = await client.query<MediaRow>(
				`SELECT ${this.imageColumns()} FROM media_assets m WHERE m.id=$1 AND m.user_id=$2 FOR UPDATE`,
				[id, ownerId],
			);
			const row = result.rows[0];
			if (!row) {
				await commit(client);
				throw new MediaHttpError(404, "Resource not found");
			}
			if (
				row.state !== "processing" ||
				row.processToken !== claim.token ||
				row.attemptId !== claim.attemptId ||
				!row.leaseUntil ||
				dateMillis(row.leaseUntil as Date | string) <= Date.now()
			) {
				throw new MediaHttpError(409, "Image processing lease expired");
			}
			const destination = this.destinationOf(row);
			if (!(await this.ownsDestination(client, ownerId, destination))) {
				await client.query("DELETE FROM media_assets WHERE id=$1", [id]);
				await commit(client);
				throw new MediaHttpError(404, "Resource not found");
			}
			await this.lockDestination(client, destination);
			if (row.kind !== "record-image") {
				const current = await this.currentCover(
					client,
					row.kind,
					destination.id,
					true,
				);
				if (current !== row.expectedCoverMediaId) {
					await client.query("DELETE FROM media_assets WHERE id=$1", [id]);
					await commit(client);
					throw new MediaHttpError(
						409,
						"Cover changed; reload the current image",
					);
				}
				const destColumn =
					row.kind === "system-cover" ? "system_id" : "collection_id";
				await client.query(
					`DELETE FROM media_assets WHERE ${destColumn}=$1 AND user_id=$2 AND kind=$3 AND state='ready'`,
					[destination.id, ownerId, row.kind],
				);
			}
			await client.query(
				`UPDATE media_assets SET state='ready',final_key=$2,output_size_bytes=$3,width=$4,height=$5,output_checksum_sha256=$6,published_at=now(),updated_at=now(),lease_until=NULL,process_token=NULL WHERE id=$1`,
				[
					id,
					claim.finalKey,
					output.size,
					output.width,
					output.height,
					output.outputChecksum,
				],
			);
			await this.touchDestination(client, row);
			const published = await client.query<MediaRow>(
				`SELECT ${this.imageColumns()} FROM media_assets m WHERE m.id=$1`,
				[id],
			);
			await commit(client);
			return mediaImage(published.rows[0]);
		} catch (error) {
			await rollback(client);
			throw error;
		} finally {
			client.release();
		}
	}

	private async releaseAttempt(
		ownerId: string,
		id: string,
		token: string,
		key: string,
	): Promise<void> {
		await pool.query(
			`UPDATE media_assets SET state='pending',process_token=NULL,lease_until=NULL,updated_at=now()
			 WHERE id=$1 AND user_id=$2 AND state='processing' AND process_token=$3`,
			[id, ownerId, token],
		);
		await pool.query(
			`INSERT INTO media_cleanup_outbox(bucket,object_key,not_before) VALUES($1,$2,now()+interval '180 seconds') ON CONFLICT(bucket,object_key) DO NOTHING`,
			[this.storage.bucket, key],
		);
	}

	private async removeReservation(id: string, ownerId: string): Promise<void> {
		await pool.query(
			"DELETE FROM media_assets WHERE id=$1 AND user_id=$2 AND state <> 'ready'",
			[id, ownerId],
		);
	}

	private async consumeRateLimit(
		client: PoolClient,
		ownerId: string,
		scope: "upload" | "complete",
		limit: number,
	): Promise<void> {
		const result = await client.query(
			`INSERT INTO media_rate_limits AS current(user_id,scope,window_started_at,request_count) VALUES($1,$2,now(),1)
			 ON CONFLICT(user_id,scope) DO UPDATE SET
			 window_started_at=CASE WHEN current.window_started_at <= now()-interval '60 seconds' THEN now() ELSE current.window_started_at END,
			 request_count=CASE WHEN current.window_started_at <= now()-interval '60 seconds' THEN 1 ELSE current.request_count+1 END
			 WHERE current.window_started_at <= now()-interval '60 seconds' OR current.request_count < $3 RETURNING request_count`,
			[ownerId, scope, limit],
		);
		if (!result.rowCount)
			throw new MediaHttpError(429, "Too many image requests", 60);
	}

	private async ownsDestination(
		client: PoolClient,
		ownerId: string,
		destination: MediaDestination,
	): Promise<boolean> {
		const sql =
			destination.kind === "system-cover"
				? "SELECT 1 FROM rpg_systems WHERE id=$1 AND user_id=$2"
				: destination.kind === "collection-cover"
					? "SELECT 1 FROM rpg_collections c JOIN rpg_systems s ON s.id=c.system_id WHERE c.id=$1 AND s.user_id=$2"
					: "SELECT 1 FROM rpg_records r JOIN rpg_templates t ON t.id=r.template_id JOIN rpg_collections c ON c.id=t.collection_id JOIN rpg_systems s ON s.id=c.system_id WHERE r.id=$1 AND s.user_id=$2";
		const result = await client.query(sql, [destination.id, ownerId]);
		return (result.rowCount ?? 0) > 0;
	}

	private async lockDestination(
		client: PoolClient,
		destination: MediaDestination,
	): Promise<void> {
		const query =
			destination.kind === "system-cover"
				? "SELECT id FROM rpg_systems WHERE id=$1 FOR UPDATE"
				: destination.kind === "collection-cover"
					? "SELECT id FROM rpg_collections WHERE id=$1 FOR UPDATE"
					: "SELECT id FROM rpg_records WHERE id=$1 FOR UPDATE";
		const result = await client.query(query, [destination.id]);
		if (!result.rowCount) throw new MediaHttpError(404, "Resource not found");
	}

	private async currentCover(
		client: PoolClient,
		kind: "system-cover" | "collection-cover",
		destinationId: string,
		lock: boolean,
	): Promise<string | null> {
		const column = kind === "system-cover" ? "system_id" : "collection_id";
		const result = await client.query<{ id: string }>(
			`SELECT id FROM media_assets WHERE kind=$1 AND ${column}=$2 AND state='ready' ${lock ? "FOR UPDATE" : ""}`,
			[kind, destinationId],
		);
		return result.rows[0]?.id ?? null;
	}

	private async touchDestination(
		client: PoolClient,
		row: MediaRow,
	): Promise<void> {
		if (row.kind === "system-cover")
			await client.query(
				"UPDATE rpg_systems SET updated_at=now() WHERE id=$1",
				[row.systemId],
			);
		else if (row.kind === "collection-cover")
			await client.query(
				"UPDATE rpg_collections SET updated_at=now() WHERE id=$1",
				[row.collectionId],
			);
		else
			await client.query(
				"UPDATE rpg_records SET updated_at=now() WHERE id=$1",
				[row.recordId],
			);
	}

	private destinationOf(row: MediaRow): MediaDestination {
		if (row.kind === "system-cover")
			return {
				kind: row.kind,
				id: row.systemId as string,
				expectedCoverMediaId: row.expectedCoverMediaId ?? null,
			};
		if (row.kind === "collection-cover")
			return {
				kind: row.kind,
				id: row.collectionId as string,
				expectedCoverMediaId: row.expectedCoverMediaId ?? null,
			};
		return { kind: row.kind, id: row.recordId as string };
	}

	private imageColumns(): string {
		return `m.id,m.kind,m.system_id AS "systemId",m.collection_id AS "collectionId",m.record_id AS "recordId",m.file_name AS "fileName",m.alt,m.state,m.final_key AS "finalKey",m.user_id AS "userId",m.bucket,m.declared_content_type AS "declaredContentType",m.declared_size_bytes AS "declaredSizeBytes",m.checksum_sha256 AS "checksumSha256",m.temporary_key AS "temporaryKey",m.complete_before AS "completeBefore",m.upload_expires_at AS "uploadExpiresAt",m.expected_cover_media_id AS "expectedCoverMediaId",m.process_token AS "processToken",m.lease_until AS "leaseUntil",m.attempt_id AS "attemptId",m.output_size_bytes AS "sizeBytes",m.width,m.height,m.created_at AS "createdAt",m.updated_at AS "updatedAt"`;
	}

	private destinationOwnershipSql(alias: string): string {
		return `((m.kind='system-cover' AND EXISTS(SELECT 1 FROM rpg_systems s WHERE s.id=${alias}.system_id AND s.user_id=$2)) OR (m.kind='collection-cover' AND EXISTS(SELECT 1 FROM rpg_collections c JOIN rpg_systems s ON s.id=c.system_id WHERE c.id=${alias}.collection_id AND s.user_id=$2)) OR (m.kind='record-image' AND EXISTS(SELECT 1 FROM rpg_records r JOIN rpg_templates t ON t.id=r.template_id JOIN rpg_collections c ON c.id=t.collection_id JOIN rpg_systems s ON s.id=c.system_id WHERE r.id=${alias}.record_id AND s.user_id=$2)))`;
	}

	private requireStorage(): void {
		try {
			this.storage.assertConfigured();
		} catch {
			throw noStorageError();
		}
	}
}
