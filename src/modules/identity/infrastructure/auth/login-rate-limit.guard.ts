import {
	HttpException,
	HttpStatus,
	Injectable,
	type CanActivate,
	type ExecutionContext,
	type OnModuleDestroy,
} from "@nestjs/common";
import type { Request, Response } from "express";

interface AttemptWindow {
	count: number;
	resetAt: number;
}

@Injectable()
export class LoginRateLimitGuard implements CanActivate, OnModuleDestroy {
	private readonly maxAttempts = 5;
	private readonly windowMs = 15 * 60 * 1000;
	private readonly attempts = new Map<string, AttemptWindow>();
	private readonly cleanupTimer: NodeJS.Timeout;

	constructor() {
		this.cleanupTimer = setInterval(() => this.clearExpiredAttempts(), this.windowMs);
		this.cleanupTimer.unref();
	}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<Request>();
		const response = context.switchToHttp().getResponse<Response>();
		const key = request.ip ?? request.socket.remoteAddress ?? "unknown";
		const now = Date.now();
		let window = this.attempts.get(key);

		if (!window || now >= window.resetAt) {
			window = { count: 0, resetAt: now + this.windowMs };
			this.attempts.set(key, window);
		}

		if (window.count >= this.maxAttempts) {
			const retryAfter = Math.ceil((window.resetAt - now) / 1000);
			response.setHeader("Retry-After", retryAfter);
			throw new HttpException(
				"Too many login attempts. Try again later.",
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}

		window.count += 1;
		return true;
	}

	onModuleDestroy(): void {
		clearInterval(this.cleanupTimer);
	}

	private clearExpiredAttempts(): void {
		const now = Date.now();
		for (const [key, window] of this.attempts) {
			if (now >= window.resetAt) {
				this.attempts.delete(key);
			}
		}
	}
}
