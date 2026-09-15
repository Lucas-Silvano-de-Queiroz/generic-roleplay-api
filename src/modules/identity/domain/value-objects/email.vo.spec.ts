import { describe, expect, it } from "vitest";
import { InvalidEmailError } from "../errors/invalid-email.error";
import { Email } from "./email.vo";

describe("Email", () => {
	it("should create an Email when the value is valid", () => {
		const email = Email.create("john@example.com");

		expect(email).toBeInstanceOf(Email);
		expect(email.value).toBe("john@example.com");
	});

	it.each([
		"plain-text",
		"john@",
		"@example.com",
		"john@example",
		"john doe@example.com",
		"",
	])(
		"should throw InvalidEmailError when the value is invalid: %s",
		(value) => {
			expect(() => Email.create(value)).toThrow(InvalidEmailError);

			try {
				Email.create(value);
				expect.unreachable();
			} catch (error) {
				expect(error).toBeInstanceOf(InvalidEmailError);
				expect((error as InvalidEmailError).code).toBe("INVALID_EMAIL");
			}
		},
	);
});
