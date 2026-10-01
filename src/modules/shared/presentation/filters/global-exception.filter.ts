import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	InternalServerErrorException,
	Logger,
} from "@nestjs/common";
import type { Response } from "express";

interface ErrorPayload {
	message?: unknown;
	details?: unknown;
}

interface ErrorDetail {
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
		const request = host.switchToHttp().getRequest?.();
		const httpException = this.resolve(exception, request?.requestId);
		const statusCode = httpException.getStatus();
		if ([401, 403, 429, 503].includes(statusCode)) {
			this.logger.warn({
				event: "security_request_rejected",
				statusCode,
				requestId: request?.requestId,
				method: request?.method,
				route: request?.route?.path,
			});
		}
		const payload = httpException.getResponse();
		const details = this.details(payload);

		response.status(statusCode).json({
			statusCode,
			message:
				statusCode === 400
					? "Validation failed"
					: this.message(payload, httpException.message),
			...(details ? { details } : {}),
		});
	}

	private resolve(exception: unknown, requestId?: string): HttpException {
		if (exception instanceof HttpException) {
			return exception;
		}
		if (
			exception instanceof Error &&
			"type" in exception &&
			exception.type === "entity.too.large"
		) {
			return new HttpException("Request body too large", 413);
		}

		this.logger.error({ event: "unexpected_error", requestId });

		return new InternalServerErrorException();
	}

	private message(payload: unknown, fallback: string): string {
		if (typeof payload === "string") {
			return payload;
		}

		if (typeof payload === "object" && payload !== null) {
			const message = (payload as ErrorPayload).message;
			if (typeof message === "string") {
				return message;
			}
			if (Array.isArray(message)) {
				return "Validation failed";
			}
		}

		return fallback;
	}

	private details(payload: unknown): ErrorDetail[] | undefined {
		if (typeof payload !== "object" || payload === null) {
			return undefined;
		}

		const errorPayload = payload as ErrorPayload;
		if (Array.isArray(errorPayload.details)) {
			const details = errorPayload.details.filter(
				(detail): detail is ErrorDetail =>
					typeof detail === "object" &&
					detail !== null &&
					typeof (detail as ErrorDetail).field === "string" &&
					typeof (detail as ErrorDetail).message === "string",
			);
			if (details.length > 0) {
				return details;
			}
		}

		if (Array.isArray(errorPayload.message)) {
			const details = errorPayload.message
				.filter((message): message is string => typeof message === "string")
				.map((message) => ({ field: "", message }));

			return details.length > 0 ? details : undefined;
		}

		return undefined;
	}
}
