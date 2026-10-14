import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	createRecordSchema,
	listRecordsQuerySchema,
	updateRecordSchema,
} from "./records.schemas";

describe("record input schemas", () => {
	it("requires values and rejects unknown properties and non-string maps", () => {
		for (const input of [
			{},
			{ values: null },
			{ values: [] },
			{ values: { name: 1 } },
			{ values: { name: false } },
			{ values: { name: null } },
			{ values: { Name: "x" } },
			{ values: { "bad.key": "x" } },
			{ values: {}, templateId: randomUUID() },
			{ values: {}, userId: randomUUID() },
			{ values: {}, createdAt: "today" },
		])
			expect(createRecordSchema.safeParse(input).success).toBe(false);
		expect(
			createRecordSchema.parse({
				values: { constructor: "  魔法\n😀 **text**  " },
			}),
		).toEqual({ values: { constructor: "  魔法\n😀 **text**  " } });
		expect(createRecordSchema.parse({ values: {} })).toEqual({ values: {} });
	});
	it("PATCH does not default values, and keeps strict create validation", () => {
		expect(updateRecordSchema.parse({})).toEqual({});
		for (const input of [
			{ values: null },
			{ values: [] },
			{ values: { text: 2 } },
			{ id: randomUUID() },
			{ values: {}, collectionId: randomUUID() },
		])
			expect(updateRecordSchema.safeParse(input).success).toBe(false);
	});
	it("enforces global UTF-16 length without transforming values", () => {
		expect(
			createRecordSchema.safeParse({ values: { text: "x".repeat(100000) } })
				.success,
		).toBe(true);
		expect(
			createRecordSchema.safeParse({ values: { text: "x".repeat(100001) } })
				.success,
		).toBe(false);
	});
	it("parses only HTTP decimal integer limits and UUID cursors", () => {
		expect(listRecordsQuerySchema.parse({})).toEqual({ limit: 50 });
		for (const limit of ["1", "50", "100"])
			expect(listRecordsQuerySchema.parse({ limit })).toEqual({
				limit: Number(limit),
			});
		const cursor = randomUUID();
		expect(listRecordsQuerySchema.parse({ cursor })).toEqual({
			limit: 50,
			cursor,
		});
		for (const limit of [
			"0",
			"101",
			"1.5",
			"1e1",
			"+1",
			" 1",
			"",
			true,
			1,
			[],
			["2"],
			null,
		])
			expect(listRecordsQuerySchema.safeParse({ limit }).success).toBe(false);
		for (const input of [
			{ cursor: "bad" },
			{ cursor: [cursor] },
			{ search: "x" },
			{ limit: "1", extra: "x" },
		])
			expect(listRecordsQuerySchema.safeParse(input).success).toBe(false);
	});
});
