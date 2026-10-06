import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users } from "../../src/modules/identity/infrastructure/database/schema/users.schema";
import { DrizzleContentRepository } from "../../src/modules/rpg-content/infrastructure/database/drizzle-content.repository";
import {
	rpgCollections,
	rpgSystems,
	rpgTemplates,
} from "../../src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema";
import {
	db,
	pool,
} from "../../src/modules/shared/infrastructure/database/drizzle";

describe("RPG content repository (PostgreSQL)", () => {
	const owner = randomUUID();
	const outsider = randomUUID();
	const repository = new DrizzleContentRepository();
	beforeAll(async () => {
		await db.insert(users).values(
			[owner, outsider].map((id) => ({
				id,
				name: "Owner",
				email: `${id}@example.com`,
				passwordHash: "unused",
			})),
		);
	});
	afterAll(async () => {
		for (const id of [owner, outsider])
			await db.delete(users).where(eq(users.id, id));
		await pool.end();
	});

	it("serializes concurrent collections at 99 to a maximum of 100", async () => {
		const system = await repository.createSystem(owner, { name: "System" });
		await db.insert(rpgCollections).values(
			Array.from({ length: 99 }, (_, i) => ({
				id: randomUUID(),
				systemId: system.id,
				name: "C",
				identifier: `c${i}`,
			})),
		);
		const results = await Promise.allSettled(
			["last_a", "last_b"].map((identifier) =>
				repository.createCollection(owner, system.id, {
					name: "C",
					identifier,
				}),
			),
		);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		const rejected = results.find((result) => result.status === "rejected");
		expect(rejected).toMatchObject({
			reason: { message: "Collection limit reached" },
		});
		expect(await repository.listCollections(owner, system.id)).toHaveLength(
			100,
		);
		expect(
			await repository.createCollection(outsider, system.id, {
				name: "Hidden",
				identifier: "hidden",
			}),
		).toBeNull();
	});

	it("serializes concurrent templates at 99 and preserves fields in JSONB", async () => {
		const system = await repository.createSystem(owner, { name: "System" });
		const collection = await repository.createCollection(owner, system.id, {
			name: "C",
			identifier: "c",
		});
		if (!collection) throw new Error("Collection missing");
		await db.insert(rpgTemplates).values(
			Array.from({ length: 99 }, (_, i) => ({
				id: randomUUID(),
				collectionId: collection.id,
				name: "T",
				identifier: `t${i}`,
			})),
		);
		const fields = [
			{
				key: "z",
				label: "Z",
				format: "textarea" as const,
				required: false,
				description: "<script>throw 'no'</script>",
			},
			{ key: "a", label: "A", format: "text" as const, required: true },
		];
		const results = await Promise.allSettled(
			["last_a", "last_b"].map((identifier) =>
				repository.createTemplate(owner, collection.id, {
					name: "T",
					identifier,
					fields,
				}),
			),
		);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.find((result) => result.status === "rejected"),
		).toMatchObject({ reason: { message: "Template limit reached" } });
		const templates = await repository.listTemplates(owner, collection.id);
		expect(templates).toHaveLength(100);
		expect(
			templates?.find((template) => template.identifier.startsWith("last"))
				?.fields,
		).toEqual(fields);
		expect(
			await repository.createTemplate(outsider, collection.id, {
				name: "Hidden",
				identifier: "hidden",
				fields: [],
			}),
		).toBeNull();
	});

	it("maps concurrent unique conflicts and isolates every direct mutation", async () => {
		const system = await repository.createSystem(owner, { name: "System" });
		const results = await Promise.allSettled(
			Array.from({ length: 2 }, () =>
				repository.createCollection(owner, system.id, {
					name: "C",
					identifier: "same",
				}),
			),
		);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.find((result) => result.status === "rejected"),
		).toMatchObject({
			reason: { message: "Collection identifier already exists" },
		});
		const [collection] = await db
			.select()
			.from(rpgCollections)
			.where(eq(rpgCollections.systemId, system.id));
		const templateResults = await Promise.allSettled(
			Array.from({ length: 2 }, () =>
				repository.createTemplate(owner, collection.id, {
					name: "T",
					identifier: "same",
					fields: [],
				}),
			),
		);
		expect(
			templateResults.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			templateResults.find((result) => result.status === "rejected"),
		).toMatchObject({
			reason: { message: "Template identifier already exists" },
		});
		const [template] = await db
			.select()
			.from(rpgTemplates)
			.where(eq(rpgTemplates.collectionId, collection.id));
		expect(
			await repository.updateSystem(outsider, system.id, { name: "Stolen" }),
		).toBeNull();
		expect(
			await repository.updateCollection(outsider, collection.id, {
				name: "Stolen",
			}),
		).toBeNull();
		expect(
			await repository.updateTemplate(outsider, template.id, { fields: [] }),
		).toBeNull();
		expect(await repository.deleteSystem(outsider, system.id)).toBe(false);
		expect(await repository.deleteCollection(outsider, collection.id)).toBe(
			false,
		);
		expect(await repository.deleteTemplate(outsider, template.id)).toBe(false);
		expect(await repository.findSystem(outsider, system.id)).toBeNull();
		expect(await repository.findCollection(outsider, collection.id)).toBeNull();
		expect(await repository.findTemplate(outsider, template.id)).toBeNull();
		expect(await repository.listCollections(outsider, system.id)).toBeNull();
		expect(await repository.listTemplates(outsider, collection.id)).toBeNull();
		expect(await repository.listSystems(outsider)).toEqual([]);
		expect(
			(
				await db.select().from(rpgSystems).where(eq(rpgSystems.id, system.id))
			)[0].name,
		).toBe("System");
	});
});
