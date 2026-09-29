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

	it("includes clean details in the exception payload", () => {
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
			details: [
				{ field: "email", message: "Invalid email address" },
				{ field: "password", message: "Password is required" },
			],
		});
	});

	it("joins nested paths into a dotted field", () => {
		const nested = new ZodValidationPipe(
			z.object({
				address: z.object({ zip: z.string().min(1, "too short") }),
			}),
		);

		let error: unknown;

		try {
			nested.transform({ address: { zip: "" } });
		} catch (caught) {
			error = caught;
		}

		const payload = (error as BadRequestException).getResponse();

		expect(payload).toMatchObject({
			message: "Validation failed",
			details: [{ field: "address.zip", message: "too short" }],
		});
	});
});
