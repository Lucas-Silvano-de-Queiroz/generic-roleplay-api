import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../../src/modules/shared/infrastructure/database/drizzle";

describe("RPG content migration", () => {
	it("applies with constraints, ordered JSON defaults and cascades from every parent", async () => {
		const client = await pool.connect();
		const schema = `rpg_${randomUUID().replaceAll("-", "")}`;
		try {
			await client.query(`CREATE SCHEMA ${schema}`);
			await client.query(`SET search_path TO ${schema}`);
			await client.query("CREATE TABLE users (id uuid PRIMARY KEY)");
			await client.query(
				readFileSync("drizzle/20261005_rpg_content.sql", "utf8"),
			);
			const user = randomUUID();
			const system = randomUUID();
			const collection = randomUUID();
			const template = randomUUID();
			await client.query("INSERT INTO users VALUES ($1)", [user]);
			await client.query(
				"INSERT INTO rpg_systems (id, user_id, name) VALUES ($1, $2, '魔法')",
				[system, user],
			);
			await client.query(
				"INSERT INTO rpg_collections (id, system_id, name, identifier) VALUES ($1, $2, 'Magias', 'spells')",
				[collection, system],
			);
			await expect(
				client.query(
					"INSERT INTO rpg_collections (id, system_id, name, identifier) VALUES ($1, $2, 'Outro', 'spells')",
					[randomUUID(), system],
				),
			).rejects.toMatchObject({ code: "23505" });
			await expect(
				client.query(
					"INSERT INTO rpg_collections (id, system_id, name, identifier) VALUES ($1, $2, 'Outro', 'Invalid')",
					[randomUUID(), system],
				),
			).rejects.toMatchObject({ code: "23514" });
			await expect(
				client.query(
					"INSERT INTO rpg_collections (id, system_id, name, identifier) VALUES ($1, $2, 'Outro', 'valid')",
					[randomUUID(), randomUUID()],
				),
			).rejects.toMatchObject({ code: "23503" });
			const created = await client.query(
				"INSERT INTO rpg_templates (id, collection_id, name, identifier) VALUES ($1, $2, 'Magia', 'spell') RETURNING fields, created_at, updated_at",
				[template, collection],
			);
			expect(created.rows[0]).toMatchObject({
				fields: [],
				created_at: expect.any(Date),
				updated_at: expect.any(Date),
			});
			await expect(
				client.query(
					"INSERT INTO rpg_templates (id, collection_id, name, identifier) VALUES ($1, $2, 'Outro', 'spell')",
					[randomUUID(), collection],
				),
			).rejects.toMatchObject({ code: "23505" });
			await client.query("DELETE FROM rpg_templates WHERE id = $1", [template]);
			expect(
				(await client.query("SELECT * FROM rpg_templates")).rows,
			).toHaveLength(0);
			await client.query(
				"INSERT INTO rpg_templates (id, collection_id, name, identifier) VALUES ($1, $2, 'Magia', 'spell')",
				[template, collection],
			);
			await client.query("DELETE FROM rpg_collections WHERE id = $1", [
				collection,
			]);
			expect(
				(await client.query("SELECT * FROM rpg_templates")).rows,
			).toHaveLength(0);
			await client.query(
				"INSERT INTO rpg_collections (id, system_id, name, identifier) VALUES ($1, $2, 'Magias', 'spells')",
				[collection, system],
			);
			await client.query(
				"INSERT INTO rpg_templates (id, collection_id, name, identifier) VALUES ($1, $2, 'Magia', 'spell')",
				[template, collection],
			);
			await client.query("DELETE FROM rpg_systems WHERE id = $1", [system]);
			expect(
				(await client.query("SELECT * FROM rpg_collections")).rows,
			).toHaveLength(0);
			expect(
				(await client.query("SELECT * FROM rpg_templates")).rows,
			).toHaveLength(0);
			await client.query(
				"INSERT INTO rpg_systems (id, user_id, name) VALUES ($1, $2, 'System')",
				[system, user],
			);
			await client.query("DELETE FROM users WHERE id = $1", [user]);
			expect(
				(await client.query("SELECT * FROM rpg_systems")).rows,
			).toHaveLength(0);
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
