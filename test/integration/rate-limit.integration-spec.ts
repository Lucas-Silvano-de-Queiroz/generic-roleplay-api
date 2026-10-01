import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { PostgreSqlRateLimitStore } from "../../src/modules/shared/infrastructure/auth/postgresql-rate-limit.store";
import {
	db,
	pool,
} from "../../src/modules/shared/infrastructure/database/drizzle";

describe("Shared rate limits", () => {
	it("enforces a single budget across instances and simultaneous calls", async () => {
		const first = new PostgreSqlRateLimitStore();
		const second = new PostgreSqlRateLimitStore();
		const key = randomUUID();
		const results = await Promise.all(
			Array.from({ length: 12 }, (_, i) =>
				(i % 2 ? first : second).consume(key, 5, 900),
			),
		);
		expect(results.filter((result) => result.allowed)).toHaveLength(5);
		expect(
			results
				.filter((result) => !result.allowed)
				.every((result) => result.retryAfter > 0),
		).toBe(true);
	});
	it("resets expired windows", async () => {
		const store = new PostgreSqlRateLimitStore();
		const key = randomUUID();
		await store.consume(key, 1, 900);
		await db.execute(
			sql`UPDATE rate_limits SET reset_at = now() - interval '1 second' WHERE key = ${key}`,
		);
		expect((await store.consume(key, 1, 900)).allowed).toBe(true);
		expect((await store.consume(key, 1, 900)).allowed).toBe(false);
	});
});

// The repository owns no resources; close this worker's pool through test lifecycle.
import { afterAll } from "vitest";

afterAll(async () => {
	await pool.end();
});
