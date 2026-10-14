import {
	ConflictException,
	HttpException,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { InvalidCredentialsError } from "./invalid-credentials.error";
import { UserAlreadyExistsError } from "./user-already-exists.error";
import { UserNotFoundError } from "./user-not-found.error";

const errors = [
	{
		error: new UserAlreadyExistsError(),
		type: ConflictException,
		status: 409,
		message: "User already exists",
	},
	{
		error: new InvalidCredentialsError(),
		type: UnauthorizedException,
		status: 401,
		message: "Invalid credentials",
	},
	{
		error: new UserNotFoundError(),
		type: NotFoundException,
		status: 404,
		message: "User not found",
	},
];

describe("application errors", () => {
	it.each(errors)(
		"should be a nest exception: $message",
		({ error, type, status, message }) => {
			expect(error).toBeInstanceOf(type);
			expect(error).toBeInstanceOf(HttpException);
			expect(error.getStatus()).toBe(status);
			expect(error.message).toBe(message);
		},
	);

	it.each(errors)("should not expose a code: $message", ({ error }) => {
		expect("code" in error).toBe(false);
	});
});
