import { createHmac } from "node:crypto";
import {
	type CanActivate,
	type ExecutionContext,
	HttpException,
	Injectable,
	Logger,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { env } from "../../config/env";
import { PostgreSqlRateLimitStore } from "./postgresql-rate-limit.store";

const policies: Record<
	string,
	{ limit: number; window: number; account?: boolean }
> = {
	"POST /auth/login": { limit: 5, window: 900, account: true },
	"POST /users": { limit: 10, window: 900 },
	"POST /auth/refresh": { limit: 30, window: 60 },
	"POST /auth/logout": { limit: 30, window: 60 },
	"DELETE /users/me": { limit: 5, window: 900 },
};

@Injectable()
export class IdentityRateLimitGuard implements CanActivate {
	private readonly logger = new Logger(IdentityRateLimitGuard.name);
	constructor(private readonly store: PostgreSqlRateLimitStore) {}
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse<Response>();
		const route = `${request.method} ${request.route?.path}`;
		const policy = policies[route];
		if (!policy) return true;
		const limits: [string, number, number][] = [
			["global", env.AUTH_GLOBAL_LIMIT, 60],
			[
				`${route}:ip:${request.ip ?? request.socket.remoteAddress ?? "unknown"}`,
				policy.limit,
				policy.window,
			],
		];
		const email = request.body?.email;
		if (policy.account && typeof email === "string" && email.length <= 512) {
			limits.push([`${route}:account:${email.trim().toLowerCase()}`, 5, 900]);
		}
		for (const [value, limit, window] of limits) {
			let result: { allowed: boolean; retryAfter: number };
			try {
				result = await this.store.consume(this.key(value), limit, window);
			} catch {
				this.logger.error({ event: "rate_limit_store_unavailable" });
				throw new ServiceUnavailableException(
					"Authentication service unavailable",
				);
			}
			if (!result.allowed) {
				response.setHeader("Retry-After", result.retryAfter);
				throw new HttpException("Too many requests. Try again later.", 429);
			}
		}
		return true;
	}
	private key(value: string): string {
		return createHmac("sha256", env.PEPPER).update(value).digest("hex");
	}
}
