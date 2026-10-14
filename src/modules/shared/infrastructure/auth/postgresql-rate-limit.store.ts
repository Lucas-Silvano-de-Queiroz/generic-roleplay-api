import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { db } from "../database/drizzle";
@Injectable()
export class PostgreSqlRateLimitStore {
	async consume(
		key: string,
		limit: number,
		windowSeconds: number,
	): Promise<{ allowed: boolean; retryAfter: number }> {
		const result = await db.execute<{ count: number; retry_after: number }>(sql`
			INSERT INTO rate_limits (key, count, reset_at)
			VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
			ON CONFLICT (key) DO UPDATE SET
				count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE LEAST(rate_limits.count + 1, ${limit + 1}) END,
				reset_at = CASE WHEN rate_limits.reset_at <= now() THEN now() + make_interval(secs => ${windowSeconds}) ELSE rate_limits.reset_at END
			RETURNING count, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (reset_at - now()))))::int AS retry_after
		`);
		const row = result.rows[0];
		return { allowed: row.count <= limit, retryAfter: row.retry_after };
	}
}
