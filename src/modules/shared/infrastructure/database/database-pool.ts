import { Logger } from "@nestjs/common";
import { Pool } from "pg";

export function createDatabasePool(
	connectionString: string,
	queryTimeoutMs: number,
): Pool {
	const logger = new Logger("DatabasePool");
	const pool = new Pool({
		connectionString,
		max: 10,
		idleTimeoutMillis: 30000,
		connectionTimeoutMillis: 5000,
		statement_timeout: queryTimeoutMs,
		query_timeout: queryTimeoutMs + 1000,
		lock_timeout: Math.min(2000, queryTimeoutMs),
	});
	pool.on("error", () => {
		logger.error({ event: "database_idle_connection_error" });
	});
	return pool;
}
