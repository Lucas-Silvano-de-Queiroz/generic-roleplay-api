import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users } from "../../src/modules/identity/infrastructure/database/schema/users.schema";
import {
	InvalidRecordValuesError,
	RecordLimitError,
} from "../../src/modules/rpg-content/application/records.errors";
import { DrizzleRecordsRepository } from "../../src/modules/rpg-content/infrastructure/database/drizzle-records.repository";
import { rpgRecords } from "../../src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema";
import {
	db,
	pool,
} from "../../src/modules/shared/infrastructure/database/drizzle";
import { recordTemplate } from "../setup/records.fixture";

describe("Records repository", () => {
	const owner = randomUUID(),
		outsider = randomUUID();
	const records = new DrizzleRecordsRepository();
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
	it("CRUD preserves literal text, replaces values, and keeps timestamps on semantic no-ops", async () => {
		const { template } = await recordTemplate(owner);
		expect(await records.list(owner, template.id, { limit: 50 })).toEqual({
			items: [],
		});
		const values = {
			name: "  Amizade\n",
			description: "**Material**: visco\n\n✨ <script>alert(1)</script>",
		};
		const record = await records.create(owner, template.id, { values });
		if (!record) throw new Error("Missing record");
		expect(record.values).toEqual(values);
		expect(await records.find(owner, record.id)).toEqual(record);
		const sibling = await records.create(owner, template.id, { values });
		expect(sibling?.id).not.toBe(record.id);
		expect(await records.update(owner, record.id, {})).toEqual(record);
		expect(
			await records.update(owner, record.id, {
				values: { description: values.description, name: values.name },
			}),
		).toEqual(record);
		// Set a persisted timestamp in the past: no sleep or wall-clock resolution assumptions.
		await db
			.update(rpgRecords)
			.set({ updatedAt: new Date("2020-01-01") })
			.where(eq(rpgRecords.id, record.id));
		const replacement = await records.update(owner, record.id, {
			values: { name: "Amizade" },
		});
		expect(replacement?.values).toEqual({ name: "Amizade" });
		expect(replacement?.createdAt).toEqual(record.createdAt);
		expect(replacement?.updatedAt.getTime()).toBeGreaterThan(
			Date.parse("2020-01-01"),
		);
		for (const values of [
			{},
			{ name: " \n" },
			{ name: "ok", extra: "x" },
		] as Record<string, string>[])
			await expect(
				records.update(owner, record.id, { values }),
			).rejects.toBeInstanceOf(InvalidRecordValuesError);
		expect(await records.find(owner, record.id)).toEqual(replacement);
		expect(await records.delete(owner, record.id)).toBe(true);
		expect(await records.delete(owner, record.id)).toBe(false);
		expect(await records.find(owner, record.id)).toBeNull();
		expect(await records.find(owner, sibling?.id ?? "")).toEqual(sibling);
	});
	it("validates empty templates and maxLength", async () => {
		const { template } = await recordTemplate(owner, []);
		expect(
			(await records.create(owner, template.id, { values: {} }))?.values,
		).toEqual({});
		await expect(
			records.create(owner, template.id, { values: { constructor: "x" } }),
		).rejects.toBeInstanceOf(InvalidRecordValuesError);
		const other = await recordTemplate(owner, [
			{
				key: "text",
				label: "Text",
				required: false,
				format: "text",
				maxLength: 2,
			},
		]);
		await expect(
			records.create(owner, other.template.id, { values: { text: "😀x" } }),
		).rejects.toBeInstanceOf(InvalidRecordValuesError);
		expect(
			(
				await records.create(owner, other.template.id, {
					values: { text: "😀" },
				})
			)?.values,
		).toEqual({ text: "😀" });
	});
	it("scopes every direct and nested operation and does not validate inaccessible templates", async () => {
		const { template } = await recordTemplate(owner);
		const record = await records.create(owner, template.id, {
			values: { name: "Secret" },
		});
		if (!record) throw new Error("Missing record");
		for (const id of [template.id, randomUUID()]) {
			expect(
				await records.create(outsider, id, { values: { bad: "x" } }),
			).toBeNull();
			expect(await records.list(outsider, id, { limit: 50 })).toBeNull();
		}
		for (const id of [record.id, randomUUID()]) {
			expect(await records.find(outsider, id)).toBeNull();
			expect(await records.update(outsider, id, { values: {} })).toBeNull();
			expect(await records.delete(outsider, id)).toBe(false);
		}
		expect(await records.find(owner, record.id)).toEqual(record);
	});
	it("paginates 101 records by ID without duplicates and scopes arbitrary cursors", async () => {
		const { template } = await recordTemplate(owner, []);
		const ids = Array.from({ length: 101 }, () => uuidv7()).sort();
		await db
			.insert(rpgRecords)
			.values(ids.map((id) => ({ id, templateId: template.id, values: {} })));
		const first = await records.list(owner, template.id, { limit: 50 });
		expect(first?.items).toHaveLength(50);
		expect(first?.nextCursor).toBe(ids[49]);
		const all: string[] = [];
		let cursor: string | undefined;
		do {
			const page = await records.list(owner, template.id, {
				limit: 50,
				...(cursor ? { cursor } : {}),
			});
			if (!page) throw new Error("Missing page");
			all.push(...page.items.map((r) => r.id));
			cursor = page.nextCursor;
		} while (cursor);
		expect(all).toEqual(ids);
		expect(
			(await records.list(owner, template.id, { limit: 1 }))?.items,
		).toHaveLength(1);
		expect(
			(await records.list(owner, template.id, { limit: 100 }))?.items,
		).toHaveLength(100);
		const last = await records.list(owner, template.id, {
			limit: 50,
			cursor: ids[99],
		});
		expect(last?.items.map((r) => r.id)).toEqual([ids[100]]);
		expect(last).not.toHaveProperty("nextCursor");
		const foreign = await recordTemplate(outsider, []);
		const foreignRecord = await records.create(outsider, foreign.template.id, {
			values: {},
		});
		await records.delete(owner, ids[50]);
		for (const cursor of [
			ids[50],
			randomUUID(),
			foreignRecord?.id ?? randomUUID(),
		]) {
			const page = await records.list(owner, template.id, {
				limit: 100,
				cursor,
			});
			expect(page?.items.map((r) => r.id)).toEqual(
				ids.filter((id) => id !== ids[50] && id > cursor),
			);
		}
	});
	it("serializes two creates at 999 to exactly 1000 records", async () => {
		const { template } = await recordTemplate(owner, []);
		await db.insert(rpgRecords).values(
			Array.from({ length: 999 }, () => ({
				id: uuidv7(),
				templateId: template.id,
				values: {},
			})),
		);
		const results = await Promise.allSettled([
			records.create(owner, template.id, { values: {} }),
			records.create(owner, template.id, { values: {} }),
		]);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
		const failed = results.find((r) => r.status === "rejected");
		if (failed?.status !== "rejected") throw new Error("Missing rejection");
		expect(failed.reason).toBeInstanceOf(RecordLimitError);
		const [total] = await db
			.select({ count: count() })
			.from(rpgRecords)
			.where(eq(rpgRecords.templateId, template.id));
		expect(total.count).toBe(1000);
	});
});
