import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../../src/modules/shared/infrastructure/database/drizzle";

describe("Standalone security schema rollout", () => {
	it("applies to an existing users table and cascades deletion of sessions", async () => {
		const client = await pool.connect();
		const schema = `audit_${randomUUID().replaceAll("-", "")}`;
		try {
			await client.query(`CREATE SCHEMA ${schema}`);
			await client.query(`SET search_path TO ${schema}`);
			await client.query("CREATE TABLE users (id uuid PRIMARY KEY)");
			await client.query(
				readFileSync("drizzle/20261001_security_state.sql", "utf8"),
			);
			const userId = randomUUID();
			await client.query("INSERT INTO users (id) VALUES ($1)", [userId]);
			await client.query(
				"INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')",
				[randomUUID(), userId, "a".repeat(64)],
			);
			await client.query("DELETE FROM users WHERE id = $1", [userId]);
			expect(
				(await client.query("SELECT count(*)::int AS count FROM sessions"))
					.rows[0].count,
			).toBe(0);
			await client.query(
				"INSERT INTO rate_limits (key, count, reset_at) VALUES ($1, 1, now())",
				["b".repeat(64)],
			);
			expect(
				(await client.query("SELECT count(*)::int AS count FROM rate_limits"))
					.rows[0].count,
			).toBe(1);
		} finally {
			await client.query("ROLLBACK");
			await client.query("SET search_path TO public");
			await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
			client.release();
		}
	});
});
afterAll(async () => {
	await pool.end();
});
