import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe";

const schema = z.object({
	email: z.email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

describe("ZodValidationPipe", () => {
	let sut: ZodValidationPipe;

	beforeEach(() => {
		sut = new ZodValidationPipe(schema);
	});

	it("returns parsed data when value is valid", () => {
		const result = sut.transform({
			email: "john@example.com",
			password: "password",
		});

		expect(result).toEqual({
			email: "john@example.com",
			password: "password",
		});
	});

	it("throws BadRequestException when value is invalid", () => {
		expect(() =>
			sut.transform({
				email: "invalid",
				password: "",
			}),
		).toThrow(BadRequestException);
	});

	it("includes validation issues in the exception payload", () => {
		let error: unknown;

		try {
			sut.transform({
				email: "invalid",
				password: "",
			});
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(BadRequestException);

		const payload = (error as BadRequestException).getResponse();

		expect(payload).toMatchObject({
			message: "Validation failed",
			errors: expect.any(Array),
		});
	});
});
