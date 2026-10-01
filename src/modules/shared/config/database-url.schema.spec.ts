import { describe, expect, it } from "vitest";
import { databaseUrlSchema } from "./database-url.schema";

describe("Database URL validation", () => {
	it("returns validation errors for malformed URLs without throwing", () => {
		expect(() => databaseUrlSchema.safeParse("not-a-url")).not.toThrow();
		expect(databaseUrlSchema.safeParse("not-a-url").success).toBe(false);
	});
	it("rejects a valid URL for a different protocol", () => {
		expect(
			databaseUrlSchema.safeParse("https://example.com/database").success,
		).toBe(false);
	});
	it("accepts PostgreSQL URLs", () => {
		expect(
			databaseUrlSchema.safeParse("postgresql://localhost/database").success,
		).toBe(true);
	});
});
