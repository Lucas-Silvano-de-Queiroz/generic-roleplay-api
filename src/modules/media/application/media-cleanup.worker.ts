import {
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
} from "@nestjs/common";
import { env } from "modules/shared/config/env";
import { pool } from "modules/shared/infrastructure/database/drizzle";
import { MediaStorageService } from "../infrastructure/s3/media-storage.service";

type CleanupTask = {
	id: string;
	bucket: string;
	objectKey: string;
	leaseToken: string;
};

@Injectable()
export class MediaCleanupWorker implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(MediaCleanupWorker.name);
	private timer: NodeJS.Timeout | undefined;
	private running = false;

	constructor(private readonly storage: MediaStorageService) {}

	onModuleInit(): void {
		this.timer = setInterval(() => void this.runOnce(), 60_000);
		this.timer.unref();
		void this.runOnce();
	}

	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
	}

	private async runOnce(): Promise<void> {
		if (this.running || !env.MEDIA_ENABLED) return;
		this.running = true;
		try {
			await pool.query(
				"DELETE FROM media_assets WHERE state <> 'ready' AND complete_before <= now()",
			);
			const claimed = await pool.query<CleanupTask>(
				`WITH due AS (
				 SELECT id FROM media_cleanup_outbox WHERE not_before <= now() AND next_attempt_at <= now()
				 AND (lease_until IS NULL OR lease_until <= now()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 100
				) UPDATE media_cleanup_outbox q SET lease_until=now()+interval '60 seconds',lease_token=gen_random_uuid()
				FROM due WHERE q.id=due.id RETURNING q.id,q.bucket,q.object_key AS "objectKey",q.lease_token AS "leaseToken"`,
			);
			for (const task of claimed.rows) await this.process(task);
		} catch {
			this.logger.warn({ event: "media_cleanup_cycle_failed" });
		} finally {
			this.running = false;
		}
	}

	private async process(task: CleanupTask): Promise<void> {
		try {
			const stillPublished = await pool.query(
				"SELECT 1 FROM media_assets WHERE bucket=$1 AND final_key=$2 AND state='ready' LIMIT 1",
				[task.bucket, task.objectKey],
			);
			if (!stillPublished.rowCount)
				await this.storage.delete(task.bucket, task.objectKey);
			await pool.query(
				"DELETE FROM media_cleanup_outbox WHERE id=$1 AND lease_token=$2",
				[task.id, task.leaseToken],
			);
		} catch (error) {
			const code = this.failureCode(error);
			await pool.query(
				`UPDATE media_cleanup_outbox SET attempts=attempts+1,
				 next_attempt_at=now()+make_interval(secs => LEAST(3600, 5 * power(2, LEAST(attempts, 10))::integer)),
				 last_failure_code=$2,lease_until=NULL,lease_token=NULL WHERE id=$1 AND lease_token=$3`,
				[task.id, code, task.leaseToken],
			);
		}
	}

	private failureCode(error: unknown): string {
		const name =
			typeof error === "object" && error !== null && "name" in error
				? String(error.name)
				: "StorageError";
		return /^[A-Za-z0-9_-]{1,64}$/.test(name) ? name : "StorageError";
	}
}
