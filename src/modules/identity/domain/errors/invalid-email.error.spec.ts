import { BadRequestException, HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { InvalidEmailError } from "./invalid-email.error";

describe("InvalidEmailError", () => {
	const error = new InvalidEmailError();

	it("should be a nest exception carrying its own status and message", () => {
		expect(error).toBeInstanceOf(BadRequestException);
		expect(error).toBeInstanceOf(HttpException);
		expect(error.getStatus()).toBe(400);
		expect(error.message).toBe("Invalid email format");
	});

	it("should not expose a code", () => {
		expect("code" in error).toBe(false);
	});
});
