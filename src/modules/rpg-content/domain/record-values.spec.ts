import { describe, expect, it } from "vitest";
import type { FieldDefinition } from "./content.schemas";
import { validateRecordValues } from "./record-values";

const field = (patch: Partial<FieldDefinition> = {}): FieldDefinition => ({
	key: "name",
	label: "Name",
	required: true,
	format: "text",
	...patch,
});
describe("template record values", () => {
	it("checks required own properties without modifying whitespace", () => {
		for (const values of [{}, { name: "" }, { name: " \t\n" }] as Record<
			string,
			string
		>[])
			expect(validateRecordValues(values, [field()])).toEqual([
				{ field: "values.name", message: expect.any(String) },
			]);
		const values = { name: "  Amizade\n魔法 😀  " };
		expect(validateRecordValues(values, [field()])).toEqual([]);
		expect(values.name).toBe("  Amizade\n魔法 😀  ");
		expect(validateRecordValues({}, [field({ required: false })])).toEqual([]);
		expect(
			validateRecordValues({ name: "" }, [field({ required: false })]),
		).toEqual([]);
	});
	it("rejects unknown keys and empty templates accept only empty values", () => {
		expect(validateRecordValues({}, [])).toEqual([]);
		expect(validateRecordValues({ constructor: "magia" }, [])).toEqual([
			{ field: "values.constructor", message: expect.any(String) },
		]);
		expect(
			validateRecordValues({ constructor: "magia" }, [
				field({ key: "constructor" }),
			]),
		).toEqual([]);
		expect(
			validateRecordValues({}, [field({ key: "constructor" })]),
		).not.toEqual([]);
		expect(
			validateRecordValues({ extra: "x" }, [field({ required: false })]),
		).toEqual([{ field: "values.extra", message: expect.any(String) }]);
		const inherited = Object.create({ name: "inherited" });
		expect(validateRecordValues(inherited, [field()])).not.toEqual([]);
	});
	it("counts UTF-16 and enforces template and global lengths", () => {
		expect(
			validateRecordValues({ name: "😀" }, [field({ maxLength: 1 })]),
		).not.toEqual([]);
		expect(
			validateRecordValues({ name: "😀" }, [field({ maxLength: 2 })]),
		).toEqual([]);
		expect(
			validateRecordValues({ name: " x " }, [field({ maxLength: 2 })]),
		).not.toEqual([]);
		expect(
			validateRecordValues({ name: "x".repeat(100000) }, [field()]),
		).toEqual([]);
		expect(
			validateRecordValues({ name: "x".repeat(100001) }, [field()]),
		).not.toEqual([]);
	});
});
