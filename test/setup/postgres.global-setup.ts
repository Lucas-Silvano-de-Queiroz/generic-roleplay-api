import { generateKeyPairSync, randomBytes } from "node:crypto";
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { pushSchema } from "drizzle-kit/api";
import { drizzle } from "drizzle-orm/node-postgres";
import { refreshTokens } from "modules/identity/infrastructure/database/schema/refresh-tokens.schema";
import * as usersSchema from "modules/identity/infrastructure/database/schema/users.schema";
import * as rpgContentSchema from "modules/rpg-content/infrastructure/database/schema/rpg-content.schema";
import { rpgRecords } from "modules/rpg-content/infrastructure/database/schema/rpg-records.schema";
import { rateLimits } from "modules/shared/infrastructure/database/schema/rate-limits.schema";
import { Pool } from "pg";
import type { TestProject } from "vitest/node";

declare module "vitest" {
	export interface ProvidedContext {
		DATABASE_URL: string;
		IDENTITY_ENV: Record<string, string>;
	}
}

let container: StartedPostgreSqlContainer | undefined;

export default async function setup(project: TestProject) {
	container = await new PostgreSqlContainer(
		"postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24",
	).start();

	const pool = new Pool({ connectionString: container.getConnectionUri() });

	try {
		const result = await pushSchema(
			{
				users: usersSchema.users,
				refreshTokens,
				rateLimits,
				...rpgContentSchema,
				rpgRecords,
			},
			drizzle(pool),
		);
		await result.apply();
	} catch (error) {
		await container.stop();
		container = undefined;
		throw error;
	} finally {
		await pool.end();
	}

	project.provide("DATABASE_URL", container.getConnectionUri());
	const keys = generateKeyPairSync("rsa", {
		modulusLength: 2048,
		privateKeyEncoding: { type: "pkcs8", format: "pem" },
		publicKeyEncoding: { type: "spki", format: "pem" },
	});
	project.provide("IDENTITY_ENV", {
		NODE_ENV: "development",
		PEPPER: randomBytes(32).toString("base64"),
		JWT_PRIVATE_KEY_BASE64: Buffer.from(keys.privateKey).toString("base64"),
		JWT_PUBLIC_KEY_BASE64: Buffer.from(keys.publicKey).toString("base64"),
	});
}

export async function teardown() {
	await container?.stop();
}
