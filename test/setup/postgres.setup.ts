import { beforeAll, inject } from "vitest";

process.env.DATABASE_URL = inject("DATABASE_URL");
Object.assign(process.env, inject("IDENTITY_ENV"));
beforeAll(async () => {
	const { db } = await import(
		"../../src/modules/shared/infrastructure/database/drizzle"
	);
	const { sql } = await import("drizzle-orm");
	await db.execute(sql`DELETE FROM rate_limits`);
});
