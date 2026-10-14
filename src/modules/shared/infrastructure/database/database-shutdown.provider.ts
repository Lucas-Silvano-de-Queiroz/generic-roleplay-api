import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { pool } from "./drizzle";

@Injectable()
export class DatabaseShutdownProvider implements OnApplicationShutdown {
	async onApplicationShutdown(): Promise<void> {
		await pool.end();
	}
}
