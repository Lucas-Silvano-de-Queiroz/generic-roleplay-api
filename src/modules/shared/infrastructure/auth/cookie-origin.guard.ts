import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { env } from "../../config/env";

@Injectable()
export class CookieOriginGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<Request>();
		if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
		const origin = request.get("Origin");
		if (!origin) {
			if (request.get("Sec-Fetch-Site") === "cross-site")
				throw new ForbiddenException("Untrusted request origin");
			return true; // Server-to-server requests do not carry browser Origin headers.
		}
		const sameOrigin = `${request.protocol}://${request.get("host")}`;
		const allowed = env.AUTH_ALLOWED_ORIGINS.split(",")
			.map((value) => value.trim())
			.filter(Boolean);
		if (origin !== sameOrigin && !allowed.includes(origin))
			throw new ForbiddenException("Untrusted request origin");
		return true;
	}
}
