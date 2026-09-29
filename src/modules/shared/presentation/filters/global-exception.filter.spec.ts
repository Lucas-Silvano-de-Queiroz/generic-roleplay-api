import type { ArgumentsHost } from "@nestjs/common";
import {
	BadRequestException,
	ConflictException,
	Logger,
	UnauthorizedException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalExceptionFilter } from "./global-exception.filter";

interface FakeResponse {
	status: ReturnType<typeof vi.fn>;
	json: ReturnType<typeof vi.fn>;
}

function createHost(response: FakeResponse, type = "http"): ArgumentsHost {
	return {
		getType: () => type,
		switchToHttp: () => ({ getResponse: () => response }),
	} as unknown as ArgumentsHost;
}

describe("GlobalExceptionFilter", () => {
	let response: FakeResponse;
	let filter: GlobalExceptionFilter;

	beforeEach(() => {
		response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
		filter = new GlobalExceptionFilter();
	});

	it("should pass a nest exception through with its status and message", () => {
		filter.catch(
			new ConflictException("User already exists"),
			createHost(response),
		);

		expect(response.status).toHaveBeenCalledWith(409);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 409,
			message: "User already exists",
		});
	});

	it("should pass the pipe built details through untouched", () => {
		const exception = new BadRequestException({
			message: "Validation failed",
			details: [
				{ field: "email", message: "Invalid email address" },
				{ field: "address.zip", message: "too short" },
			],
		});

		filter.catch(exception, createHost(response));

		expect(response.status).toHaveBeenCalledWith(400);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 400,
			message: "Validation failed",
			details: [
				{ field: "email", message: "Invalid email address" },
				{ field: "address.zip", message: "too short" },
			],
		});
	});

	it("should hide an unknown error behind a generic 500 and log it", () => {
		const logSpy = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);

		filter.catch(new Error("boom"), createHost(response));

		expect(logSpy).toHaveBeenCalled();
		expect(response.status).toHaveBeenCalledWith(500);
		expect(response.json).toHaveBeenCalledWith({
			statusCode: 500,
			message: "Internal Server Error",
		});

		logSpy.mockRestore();
	});

	it("should rethrow when the context is not http", () => {
		const error = new Error("boom");

		expect(() => filter.catch(error, createHost(response, "rpc"))).toThrow(
			error,
		);
		expect(response.status).not.toHaveBeenCalled();
	});

	it("should keep unauthorized responses without extra keys", () => {
		filter.catch(new UnauthorizedException(), createHost(response));

		expect(response.json).toHaveBeenCalledWith({
			statusCode: 401,
			message: "Unauthorized",
		});
	});
});
