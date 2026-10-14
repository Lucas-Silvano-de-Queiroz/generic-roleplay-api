import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../../src/modules/shared/infrastructure/database/drizzle";

describe("Records additive migration", () => {
	it("preserves existing content, enforces constraints and cascades every ancestor", async () => {
		const client = await pool.connect();
		const schema = `records_${randomUUID().replaceAll("-", "")}`;
		try {
			await client.query(`CREATE SCHEMA ${schema}`);
			await client.query(`SET search_path TO ${schema}`);
			await client.query("CREATE TABLE users (id uuid PRIMARY KEY)");
			await client.query(
				readFileSync("drizzle/20261005_rpg_content.sql", "utf8"),
			);
			const user = randomUUID(),
				system = randomUUID(),
				collection = randomUUID(),
				template = randomUUID();
			async function tree() {
				await client.query(
					"INSERT INTO users VALUES ($1) ON CONFLICT DO NOTHING",
					[user],
				);
				await client.query(
					"INSERT INTO rpg_systems (id,user_id,name) VALUES ($1,$2,'System') ON CONFLICT DO NOTHING",
					[system, user],
				);
				await client.query(
					"INSERT INTO rpg_collections (id,system_id,name,identifier) VALUES ($1,$2,'Magias','spells') ON CONFLICT DO NOTHING",
					[collection, system],
				);
				await client.query(
					"INSERT INTO rpg_templates (id,collection_id,name,identifier,fields) VALUES ($1,$2,'Magia','spell',$3) ON CONFLICT DO NOTHING",
					[
						template,
						collection,
						JSON.stringify([
							{ key: "name", label: "Name", required: true, format: "text" },
						]),
					],
				);
			}
			await tree();
			const tables = ["rpg_systems", "rpg_collections", "rpg_templates"];
			const before = [];
			for (const table of tables)
				before.push((await client.query(`SELECT * FROM ${table}`)).rows);
			await client.query(
				readFileSync("drizzle/20261005_rpg_records.sql", "utf8"),
			);
			const after = [];
			for (const table of tables)
				after.push((await client.query(`SELECT * FROM ${table}`)).rows);
			expect(after).toEqual(before);
			const insert = async (
				values: unknown = { name: "  魔法\n😀 **text**  " },
				parent = template,
			) =>
				client.query(
					"INSERT INTO rpg_records (id,template_id,values) VALUES ($1,$2,$3) RETURNING *",
					[randomUUID(), parent, JSON.stringify(values)],
				);
			const first = (await insert()).rows[0];
			expect(first).toMatchObject({
				values: { name: "  魔法\n😀 **text**  " },
				created_at: expect.any(Date),
				updated_at: expect.any(Date),
			});
			expect(first.created_at).toEqual(first.updated_at);
			for (const invalid of [[], null, "text", 1])
				await expect(insert(invalid)).rejects.toMatchObject({ code: "23514" });
			await expect(insert({}, randomUUID())).rejects.toMatchObject({
				code: "23503",
			});
			await insert();
			await client.query("DELETE FROM rpg_records WHERE id=$1", [first.id]);
			expect(
				(await client.query("SELECT * FROM rpg_records")).rows,
			).toHaveLength(1);
			expect(
				(await client.query("SELECT * FROM rpg_templates")).rows,
			).toHaveLength(1);
			for (const [table, id] of [
				["rpg_templates", template],
				["rpg_collections", collection],
				["rpg_systems", system],
				["users", user],
			]) {
				await tree();
				await insert();
				await client.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
				expect((await client.query("SELECT * FROM rpg_records")).rows).toEqual(
					[],
				);
			}
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
