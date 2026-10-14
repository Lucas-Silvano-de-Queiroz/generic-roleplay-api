import { describe, expect, it } from "vitest";
import {
	createCollectionSchema,
	createSystemSchema,
	createTemplateSchema,
	fieldDefinitionSchema,
	fieldsSchema,
	identifierSchema,
	updateCollectionSchema,
	updateSystemSchema,
	updateTemplateSchema,
} from "./content.schemas";

describe("Content contracts", () => {
	it.each(["spell", "magic_items", "magic-items", "spell2"])(
		"accepts canonical identifier %s",
		(value) => {
			expect(identifierSchema.parse(value)).toBe(value);
		},
	);
	it.each([
		"Spell",
		"2spell",
		"magic items",
		"magic!",
		"",
		" ",
		" spell",
		"spell ",
		"a".repeat(65),
		"魔法",
		"spell\n",
		"spell\r",
		"spell\u2028",
		"spell\u2029",
	])("rejects identifier %s", (value) => {
		expect(identifierSchema.safeParse(value).success).toBe(false);
	});
	it("trims names and labels and allows Unicode and arbitrary categories", () => {
		expect(createSystemSchema.parse({ name: " 魔法 " })).toEqual({
			name: "魔法",
		});
		expect(
			createTemplateSchema.parse({
				name: "Магия",
				identifier: "spell",
				category: "自由",
				fields: [{ key: "name", label: " Nome " }],
			}),
		).toEqual({
			name: "Магия",
			identifier: "spell",
			category: "自由",
			fields: [{ key: "name", label: "Nome", required: false, format: "text" }],
		});
	});
	it("preserves field order, defaults and literal text", () => {
		const fields = [
			{
				key: "z",
				label: "Z",
				description: "<script>alert(1)</script> **text**",
				format: "textarea",
			},
			{
				key: "a",
				label: "A",
				required: true,
				maxLength: 100000,
				format: "textarea",
			},
		];
		expect(fieldsSchema.parse(fields)).toEqual([
			{ ...fields[0], required: false },
			fields[1],
		]);
		expect(
			createTemplateSchema.parse({ name: "Spell", identifier: "spell" }).fields,
		).toEqual([]);
	});
	it.each([
		{ key: "Invalid", label: "Label" },
		{ key: "name", label: " " },
		{ key: "name", label: "a".repeat(101) },
		{ key: "name", label: "Name", description: "a".repeat(1001) },
		{ key: "name", label: "Name", required: "false" },
		{ key: "name", label: "Name", required: null },
		{ key: "name", label: "Name", format: "html" },
		{ key: "name", label: "Name", format: "markdown" },
		{ key: "name", label: "Name", format: null },
		{ key: "name", label: "Name", banana: true },
		...[0, -1, 1.5, 100001, "10", null].map((maxLength) => ({
			key: "name",
			label: "Name",
			maxLength,
		})),
	])("rejects invalid field %j", (field) => {
		expect(fieldDefinitionSchema.safeParse(field).success).toBe(false);
	});
	it("rejects duplicate keys and arrays above 100, accepts empty arrays", () => {
		expect(fieldsSchema.parse([])).toEqual([]);
		expect(
			fieldsSchema.safeParse([
				{ key: "name", label: "N" },
				{ key: "name", label: "Other" },
			]).success,
		).toBe(false);
		const fields = Array.from({ length: 100 }, (_, i) => ({
			key: `field${i}`,
			label: "N",
		}));
		expect(fieldsSchema.parse(fields)).toHaveLength(100);
		expect(
			fieldsSchema.safeParse([...fields, { key: "extra", label: "N" }]).success,
		).toBe(false);
	});
	it("enforces strict create and PATCH payloads, null and type rules", () => {
		for (const schema of [
			createSystemSchema,
			createCollectionSchema,
			createTemplateSchema,
		]) {
			expect(
				schema.safeParse({ name: "N", identifier: "valid", userId: "owner" })
					.success,
			).toBe(false);
			expect(schema.safeParse({ name: " ", identifier: "valid" }).success).toBe(
				false,
			);
			expect(
				schema.safeParse({ name: "a".repeat(101), identifier: "valid" })
					.success,
			).toBe(false);
		}
		for (const schema of [
			updateSystemSchema,
			updateCollectionSchema,
			updateTemplateSchema,
		]) {
			expect(schema.parse({})).toEqual({});
			expect(schema.parse({ name: "New" })).toEqual({ name: "New" });
			expect(schema.safeParse({ description: null }).success).toBe(false);
			expect(schema.safeParse({ name: 10 }).success).toBe(false);
			expect(schema.safeParse({ description: "a".repeat(5001) }).success).toBe(
				false,
			);
			expect(schema.safeParse({ systemId: "move" }).success).toBe(false);
		}
		expect(createCollectionSchema.safeParse({ name: "N" }).success).toBe(false);
		expect(createTemplateSchema.safeParse({ name: "N" }).success).toBe(false);
		expect(
			createTemplateSchema.safeParse({
				name: "N",
				identifier: "valid",
				category: "a".repeat(65),
			}).success,
		).toBe(false);
		expect(updateTemplateSchema.parse({ fields: [] })).toEqual({ fields: [] });
	});
});
