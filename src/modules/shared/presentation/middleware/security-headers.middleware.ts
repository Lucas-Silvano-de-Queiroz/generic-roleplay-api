import { randomUUID } from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env";

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
	use(
		request: Request & { requestId?: string },
		response: Response,
		next: NextFunction,
	): void {
		request.requestId ??= randomUUID();
		response.setHeader("X-Request-Id", request.requestId);
		response.setHeader("Cache-Control", "no-store");
		response.setHeader("X-Content-Type-Options", "nosniff");
		response.setHeader("Referrer-Policy", "no-referrer");
		response.setHeader("X-Frame-Options", "DENY");
		if (env.isProduction)
			response.setHeader("Strict-Transport-Security", "max-age=31536000");
		response.removeHeader("X-Powered-By");
		next();
	}
}
