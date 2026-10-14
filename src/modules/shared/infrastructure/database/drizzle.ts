import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "modules/shared/config/env";
import { createDatabasePool } from "./database-pool";

export const pool = createDatabasePool(
	env.DATABASE_URL,
	env.DATABASE_QUERY_TIMEOUT_MS,
);

export const db = drizzle(pool);
