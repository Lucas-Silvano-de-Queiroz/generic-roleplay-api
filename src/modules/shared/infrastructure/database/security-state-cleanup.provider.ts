import {
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { sql } from "drizzle-orm";
import { db } from "./drizzle";
@Injectable()
export class SecurityStateCleanupProvider
	implements OnModuleInit, OnModuleDestroy
{
	private readonly logger = new Logger(SecurityStateCleanupProvider.name);
	private timer?: NodeJS.Timeout;
	private running = false;
	onModuleInit(): void {
		this.timer = setInterval(() => {
			void this.cleanup();
		}, 30000);
		this.timer.unref();
	}
	onModuleDestroy(): void {
		if (this.timer) clearInterval(this.timer);
	}
	private async cleanup(): Promise<void> {
		if (this.running) return;
		this.running = true;
		try {
			await db.execute(
				sql`DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE reset_at < now() ORDER BY reset_at LIMIT 4096 FOR UPDATE SKIP LOCKED)`,
			);
			await db.execute(
				sql`DELETE FROM sessions WHERE id IN (SELECT id FROM sessions WHERE expires_at < now() ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED)`,
			);
		} catch {
			this.logger.error({ event: "security_state_cleanup_failed" });
		} finally {
			this.running = false;
		}
	}
}
