import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { ApplicationError } from "modules/shared/application/errors/application.error";
import { DomainError } from "modules/shared/domain/errors/domain.error";

const DOMAIN_STATUS_BY_CODE = {
	INVALID_EMAIL: 400,
	INVALID_CREDENTIALS: 401,
	USER_NOT_FOUND: 404,
	USER_ALREADY_EXISTS: 409,
} as const;

const HTTP_ERROR_CODES: Record<number, string> = {
	400: "BAD_REQUEST",
	401: "UNAUTHORIZED",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	405: "METHOD_NOT_ALLOWED",
	409: "CONFLICT",
	422: "UNPROCESSABLE_ENTITY",
	429: "TOO_MANY_REQUESTS",
	500: "INTERNAL_SERVER_ERROR",
	502: "BAD_GATEWAY",
	503: "SERVICE_UNAVAILABLE",
};

interface ValidationPayload {
	message?: unknown;
	errors?: unknown;
}

interface ValidationDetail {
	field: string;
	message: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
	private readonly logger = new Logger(GlobalExceptionFilter.name);

	catch(exception: unknown, host: ArgumentsHost) {
		if (host.getType() !== "http") {
			throw exception;
		}

		const response = host.switchToHttp().getResponse<Response>();

		if (
			exception instanceof DomainError ||
			exception instanceof ApplicationError
		) {
			const status = this.statusForCode(exception.code);
			this.sendError(response, status, exception.code, exception.message);
			return;
		}

		if (exception instanceof HttpException) {
			const status = exception.getStatus();

			const payload = exception.getResponse();

			if (this.isValidationPayload(payload)) {
				const details = this.validationDetails(payload.errors);
				this.sendError(
					response,
					400,
					"VALIDATION_ERROR",
					"Validation failed",
					details,
				);
				return;
			}

			const code = HTTP_ERROR_CODES[status] ?? "INTERNAL_SERVER_ERROR";
			const message = this.messageFromPayload(payload, exception.message);
			this.sendError(response, status, code, message);
			return;
		}

		const message =
			exception instanceof Error ? exception.message : String(exception);
		const stack = exception instanceof Error ? exception.stack : undefined;
		this.logger.error(`Unhandled error: ${message}`, stack);

		this.sendError(
			response,
			500,
			"INTERNAL_SERVER_ERROR",
			"Internal server error",
		);
	}

	private statusForCode(code: string): number {
		return (
			DOMAIN_STATUS_BY_CODE[code as keyof typeof DOMAIN_STATUS_BY_CODE] ?? 500
		);
	}

	private isValidationPayload(payload: unknown): payload is ValidationPayload {
		if (typeof payload !== "object" || payload === null) {
			return false;
		}

		const errors = (payload as ValidationPayload).errors;
		return Array.isArray(errors) && errors.length > 0;
	}

	private validationDetails(errors: unknown): ValidationDetail[] {
		return (errors as { path?: unknown; message?: unknown }[]).map((error) => ({
			field: this.fieldFromPath(error.path),
			message:
				typeof error.message === "string"
					? error.message
					: String(error.message),
		}));
	}

	private fieldFromPath(path: unknown): string {
		if (!Array.isArray(path)) {
			return "";
		}

		return path.join(".");
	}

	private messageFromPayload(payload: unknown, fallback: string): string {
		if (typeof payload === "string") {
			return payload;
		}

		if (typeof payload === "object" && payload !== null) {
			const message = (payload as { message?: unknown }).message;
			if (typeof message === "string") {
				return message;
			}
		}

		return fallback;
	}

	private sendError(
		response: Response,
		statusCode: number,
		code: string,
		message: string,
		details?: ValidationDetail[],
	) {
		response.status(statusCode).json({
			statusCode,
			code,
			message,
			...(details ? { details } : {}),
		});
	}
}
