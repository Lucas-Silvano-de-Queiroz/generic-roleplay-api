import { describe, expect, it } from "vitest";
import { Email } from "../../../domain/value-objects/email.vo";
import { createUserSchema } from "./create-user.dto";
import { deleteUserSchema } from "./delete-user.dto";
import { loginSchema } from "./login.dto";
import { refreshTokenSchema } from "./refresh-token.dto";

describe("Identity input limits", () => {
	it.each([" ", "a".repeat(256)])(
		"rejects invalid names before persistence",
		(name) => {
			expect(
				createUserSchema.safeParse({
					name,
					email: "a@example.com",
					password: "password",
				}).success,
			).toBe(false);
		},
	);
	it("normalizes the display name", () => {
		expect(
			createUserSchema.parse({
				name: "  Ana  ",
				email: "a@example.com",
				password: "password",
			}).name,
		).toBe("Ana");
	});
	it("rejects oversized passwords on every password endpoint", () => {
		const password = "a".repeat(1025);
		expect(
			createUserSchema.safeParse({
				name: "Ana",
				email: "a@example.com",
				password,
			}).success,
		).toBe(false);
		expect(
			loginSchema.safeParse({ email: "a@example.com", password }).success,
		).toBe(false);
		expect(deleteUserSchema.safeParse({ password }).success).toBe(false);
	});
	it("rejects oversized refresh tokens", () => {
		expect(
			refreshTokenSchema.safeParse({ refreshToken: "a".repeat(4097) }).success,
		).toBe(false);
	});
	it("rejects oversized e-mails at the domain boundary", () => {
		expect(() => Email.create(`${"a".repeat(256)}@example.com`)).toThrow();
	});
	it.each(["a@..", "a@.x", "a@x.", "a@x.y\nX", "a@@x.y"])(
		"rejects malformed domain input %s",
		(value) => {
			expect(() => Email.create(value)).toThrow();
		},
	);
	it("supports the database name limit with astral Unicode", () => {
		expect(
			createUserSchema.safeParse({
				name: "😀".repeat(255),
				email: "a@example.com",
				password: "password",
			}).success,
		).toBe(true);
	});
});
