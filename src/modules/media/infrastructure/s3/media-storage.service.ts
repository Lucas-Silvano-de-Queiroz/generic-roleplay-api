import { createHash } from "node:crypto";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadBucketCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable } from "@nestjs/common";
import { env } from "modules/shared/config/env";

const TEN_MIB = 10 * 1024 * 1024;

@Injectable()
export class MediaStorageService {
	private readonly runtimeClient: S3Client | null;
	private readonly browserClient: S3Client | null;
	readonly bucket = env.S3_BUCKET ?? "";

	constructor() {
		const base = {
			region: env.S3_REGION,
			forcePathStyle: env.S3_FORCE_PATH_STYLE,
			requestChecksumCalculation: "WHEN_REQUIRED" as const,
			responseChecksumValidation: "WHEN_REQUIRED" as const,
		};
		this.runtimeClient = env.MEDIA_ENABLED
			? new S3Client({
					...base,
					...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
				})
			: null;
		this.browserClient = env.MEDIA_ENABLED
			? new S3Client({
					...base,
					...((env.S3_BROWSER_ENDPOINT ?? env.S3_ENDPOINT)
						? { endpoint: env.S3_BROWSER_ENDPOINT ?? env.S3_ENDPOINT }
						: {}),
				})
			: null;
	}

	assertConfigured(): void {
		if (!this.runtimeClient || !this.browserClient || !this.bucket) {
			throw new Error("Private image storage is not configured");
		}
	}

	async signPut(
		key: string,
		contentType: string,
		checksumSha256: string,
		bucket = this.bucket,
	) {
		this.assertConfigured();
		const expiresIn = await this.effectiveTtl(this.browserClient as S3Client);
		const url = await getSignedUrl(
			this.browserClient as S3Client,
			new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				ContentType: contentType,
				ChecksumSHA256: checksumSha256,
			}),
			{
				expiresIn,
				signableHeaders: new Set(["content-type"]),
				unhoistableHeaders: new Set(["x-amz-checksum-sha256"]),
			},
		);
		return {
			url,
			expiresAt: new Date(Date.now() + expiresIn * 1000),
			headers: {
				"content-type": contentType,
				"x-amz-checksum-sha256": checksumSha256,
			},
		};
	}

	async signGet(key: string, bucket = this.bucket) {
		this.assertConfigured();
		const expiresIn = await this.effectiveTtl(this.browserClient as S3Client);
		const url = await getSignedUrl(
			this.browserClient as S3Client,
			new GetObjectCommand({ Bucket: bucket, Key: key }),
			{ expiresIn },
		);
		return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
	}

	async head(key: string, bucket = this.bucket): Promise<{ size: number }> {
		this.assertConfigured();
		const result = await (this.runtimeClient as S3Client).send(
			new HeadObjectCommand({ Bucket: bucket, Key: key }),
			{ abortSignal: AbortSignal.timeout(30_000) },
		);
		return { size: result.ContentLength ?? -1 };
	}

	async readLimited(key: string, bucket = this.bucket): Promise<Buffer> {
		this.assertConfigured();
		const result = await (this.runtimeClient as S3Client).send(
			new GetObjectCommand({ Bucket: bucket, Key: key }),
			{ abortSignal: AbortSignal.timeout(30_000) },
		);
		const body = result.Body;
		if (!body) throw new Error("Storage returned an empty body");
		const chunks: Buffer[] = [];
		let size = 0;
		const readTimeout = setTimeout(() => {
			if ("destroy" in body && typeof body.destroy === "function")
				body.destroy();
		}, 30_000);
		try {
			for await (const chunk of body as AsyncIterable<Uint8Array>) {
				const buffer = Buffer.from(chunk);
				size += buffer.byteLength;
				if (size > TEN_MIB) {
					if ("destroy" in body && typeof body.destroy === "function")
						body.destroy();
					throw new MediaObjectTooLargeError();
				}
				chunks.push(buffer);
			}
		} catch (error) {
			if (error instanceof MediaObjectTooLargeError) throw error;
			throw new Error("Storage read failed");
		} finally {
			clearTimeout(readTimeout);
		}
		return Buffer.concat(chunks, size);
	}

	async putValidated(
		key: string,
		bytes: Buffer,
		bucket = this.bucket,
	): Promise<string> {
		this.assertConfigured();
		const checksumSha256 = createHash("sha256").update(bytes).digest("base64");
		await (this.runtimeClient as S3Client).send(
			new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				Body: bytes,
				ContentLength: bytes.byteLength,
				ContentType: "image/webp",
				ChecksumSHA256: checksumSha256,
				CacheControl: "private, no-store",
			}),
			{ abortSignal: AbortSignal.timeout(30_000) },
		);
		return checksumSha256;
	}

	async delete(bucket: string, key: string): Promise<void> {
		this.assertConfigured();
		await (this.runtimeClient as S3Client).send(
			new DeleteObjectCommand({ Bucket: bucket, Key: key }),
			{ abortSignal: AbortSignal.timeout(30_000) },
		);
	}

	async checkBucket(): Promise<void> {
		this.assertConfigured();
		await (this.runtimeClient as S3Client).send(
			new HeadBucketCommand({ Bucket: this.bucket }),
			{ abortSignal: AbortSignal.timeout(30_000) },
		);
	}

	private async effectiveTtl(client: S3Client): Promise<number> {
		const credentials = await client.config.credentials();
		const remaining = credentials.expiration
			? Math.floor((credentials.expiration.getTime() - Date.now()) / 1000)
			: 300;
		if (remaining < 1) throw new Error("Storage signing credentials expired");
		return Math.min(300, remaining);
	}
}

export class MediaObjectTooLargeError extends Error {
	constructor() {
		super("Media object exceeds the input size limit");
	}
}
