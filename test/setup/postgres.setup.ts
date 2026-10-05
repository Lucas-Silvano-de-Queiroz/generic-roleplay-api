import { beforeAll, inject } from "vitest";

process.env.DATABASE_URL = inject("DATABASE_URL");
Object.assign(process.env, inject("IDENTITY_ENV"));
beforeAll(async () => {
	const { pool } = await import(
		"../../src/modules/shared/infrastructure/database/drizzle.js"
	);
	await pool.query("DELETE FROM rate_limits");
});
