import {
	ArgumentsHost,
	BadRequestException,
	HttpException,
	Logger,
	UnauthorizedException,
} from "@nestjs/common";
import type { Response } from "express";
import { InvalidCredentialsError } from "modules/identity/application/errors/invalid-credentials.error";
import { UserAlreadyExistsError } from "modules/identity/application/errors/user-already-exists.error";
import { UserNotFoundError } from "modules/identity/application/errors/user-not-found.error";
import { InvalidEmailError } from "modules/identity/domain/errors/invalid-email.error";
import { ApplicationError } from "modules/shared/application/errors/application.error";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalExceptionFilter } from "./global-exception.filter";

interface MockResponse {
	status: ReturnType<typeof vi.fn>;
	json: ReturnType<typeof vi.fn>;
}

function createHttpHost(): { host: ArgumentsHost; response: MockResponse } {
	const json = vi.fn();
	const status = vi.fn().mockReturnThis();
	const response = { status, json } as unknown as Response & MockResponse;

	const host = {
		getType: () => "http",
		switchToHttp: () => ({ getResponse: () => response }),
	} as unknown as ArgumentsHost;

	return { host, response };
}

describe("GlobalExceptionFilter", () => {
	let sut: GlobalExceptionFilter;

	beforeEach(() => {
		vi.restoreAllMocks();
		// silence error logs produced when handling unknown exceptions
		vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});

		sut = new GlobalExceptionFilter();
	});

	it("maps DomainError to status, code and message", () => {
		const { host, response } = createHttpHost();

		sut.catch(new InvalidEmailError(), host);

		expect(response.status).toHaveBeenCalledWith(400);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 400,
			code: "INVALID_EMAIL",
			message: "Invalid email format",
		});
	});

	it.each([
		[
			new InvalidCredentialsError(),
			401,
			"INVALID_CREDENTIALS",
			"Invalid credentials",
		],
		[new UserNotFoundError(), 404, "USER_NOT_FOUND", "User not found"],
		[
			new UserAlreadyExistsError(),
			409,
			"USER_ALREADY_EXISTS",
			"User already exists",
		],
	])(
		"maps ApplicationError %# to status, code and message",
		(error, status, code, message) => {
			const { host, response } = createHttpHost();

			sut.catch(error, host);

			expect(response.status).toHaveBeenCalledWith(status);
			expect(response.json).toHaveBeenCalledWith({
				statusCode: status,
				code,
				message,
			});
		},
	);

	it("normalizes Zod validation errors to 400 with details", () => {
		const { host, response } = createHttpHost();

		const exception = new BadRequestException({
			message: "Validation failed",
			errors: [
				{ code: "invalid_email", message: "Invalid email", path: ["email"] },
				{ code: "too_small", message: "Too short", path: ["user", "password"] },
			],
		});

		sut.catch(exception, host);

		expect(response.status).toHaveBeenCalledWith(400);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 400,
			code: "VALIDATION_ERROR",
			message: "Validation failed",
			details: [
				{ field: "email", message: "Invalid email" },
				{ field: "user.password", message: "Too short" },
			],
		});
	});

	it("derives code from status for HttpException", () => {
		const { host, response } = createHttpHost();

		sut.catch(new HttpException("Method not allowed", 405), host);

		expect(response.status).toHaveBeenCalledWith(405);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 405,
			code: "METHOD_NOT_ALLOWED",
			message: "Method not allowed",
		});
	});

	it("normalizes HttpException with string response", () => {
		const { host, response } = createHttpHost();

		sut.catch(new UnauthorizedException(), host);

		expect(response.status).toHaveBeenCalledWith(401);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 401,
			code: "UNAUTHORIZED",
			message: "Unauthorized",
		});
	});

	it("normalizes HttpException with object response", () => {
		const { host, response } = createHttpHost();

		sut.catch(
			new BadRequestException({ message: "Something went wrong" }),
			host,
		);

		expect(response.status).toHaveBeenCalledWith(400);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 400,
			code: "BAD_REQUEST",
			message: "Something went wrong",
		});
	});

	it("maps unknown errors to 500 INTERNAL_SERVER_ERROR", () => {
		const { host, response } = createHttpHost();

		sut.catch(new Error("boom"), host);

		expect(response.status).toHaveBeenCalledWith(500);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 500,
			code: "INTERNAL_SERVER_ERROR",
			message: "Internal server error",
		});
	});

	it("does not leak the internal message for unknown errors", () => {
		const { host, response } = createHttpHost();

		sut.catch(new Error("secret db password leaked"), host);

		const body = response.json.mock.calls[0][0];
		expect(body.message).toBe("Internal server error");
		expect(body.message).not.toContain("secret");
	});

	it("maps ApplicationError with unknown code to 500 INTERNAL_SERVER_ERROR", () => {
		class UnknownDomainError extends ApplicationError {
			readonly code = "SOME_UNKNOWN_CODE";
			constructor() {
				super("something unexpected");
			}
		}

		const { host, response } = createHttpHost();

		sut.catch(new UnknownDomainError(), host);

		expect(response.status).toHaveBeenCalledWith(500);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 500,
			code: "SOME_UNKNOWN_CODE",
			message: "something unexpected",
		});
	});

	it("falls back to INTERNAL_SERVER_ERROR code for unmapped HttpException status", () => {
		const { host, response } = createHttpHost();

		sut.catch(new HttpException("I'm a teapot", 418), host);

		expect(response.status).toHaveBeenCalledWith(418);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 418,
			code: "INTERNAL_SERVER_ERROR",
			message: "I'm a teapot",
		});
	});

	it("falls back to the exception message when object payload has no message", () => {
		const { host, response } = createHttpHost();

		sut.catch(new BadRequestException({}), host);

		expect(response.status).toHaveBeenCalledWith(400);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 400,
			code: "BAD_REQUEST",
			message: "Bad Request Exception",
		});
	});

	it("treats empty validation errors as a regular HttpException", () => {
		const { host, response } = createHttpHost();

		sut.catch(
			new BadRequestException({ message: "Validation failed", errors: [] }),
			host,
		);

		expect(response.status).toHaveBeenCalledWith(400);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 400,
			code: "BAD_REQUEST",
			message: "Validation failed",
		});
	});

	it("normalizes malformed validation issues safely", () => {
		const { host, response } = createHttpHost();

		const exception = new BadRequestException({
			message: "Validation failed",
			errors: [{ path: "not-an-array", message: 123 }],
		});

		sut.catch(exception, host);

		expect(response.status).toHaveBeenCalledWith(400);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 400,
			code: "VALIDATION_ERROR",
			message: "Validation failed",
			details: [{ field: "", message: "123" }],
		});
	});

	it("maps non-error thrown values to 500 INTERNAL_SERVER_ERROR", () => {
		const { host, response } = createHttpHost();

		sut.catch("a thrown string", host);

		expect(response.status).toHaveBeenCalledWith(500);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 500,
			code: "INTERNAL_SERVER_ERROR",
			message: "Internal server error",
		});
	});

	it("rethrows non-http exceptions without intercepting", () => {
		const host = {
			getType: () => "graphql",
			switchToHttp: () => {
				throw new Error("should not be called");
			},
		} as unknown as ArgumentsHost;

		const error = new Error("non-http");

		expect(() => sut.catch(error, host)).toThrow(error);
	});
});
