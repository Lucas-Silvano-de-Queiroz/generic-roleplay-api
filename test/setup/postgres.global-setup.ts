import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { pushSchema } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as usersSchema from "src/modules/identity/infrastructure/database/schema/users.schema";
import type { TestProject } from "vitest/node";

declare module "vitest" {
	export interface ProvidedContext {
		DATABASE_URL: string;
	}
}

let container: StartedPostgreSqlContainer | undefined;

export default async function setup(project: TestProject) {
	container = await new PostgreSqlContainer("postgres:17-alpine").start();

	const pool = new Pool({ connectionString: container.getConnectionUri() });
	const result = await pushSchema({ users: usersSchema.users }, drizzle(pool));
	await result.apply();
	await pool.end();

	project.provide("DATABASE_URL", container.getConnectionUri());
}

export async function teardown() {
	await container?.stop();
}
