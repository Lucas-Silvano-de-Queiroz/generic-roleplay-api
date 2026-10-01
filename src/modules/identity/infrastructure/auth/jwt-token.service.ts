import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { z } from "zod";
import { env } from "../../../shared/config/env";
import type {
	TokenPair,
	TokenServiceContract,
} from "../../application/contracts/token-service.contract.token";
import { InvalidCredentialsError } from "../../application/errors/invalid-credentials.error";
import {
	SESSION_REPOSITORY,
	type SessionRepository,
} from "../../domain/repositories/session.repository";

const refreshPayloadSchema = z.object({
	sub: z.uuid(),
	sid: z.uuid(),
	jti: z.uuid(),
	tokenUse: z.literal("refresh"),
	exp: z.number().int().positive(),
});
@Injectable()
export class JwtTokenService implements TokenServiceContract {
	private readonly logger = new Logger(JwtTokenService.name);
	constructor(
		private readonly jwtService: JwtService,
		@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
	) {}
	async createSession(userId: string): Promise<TokenPair> {
		const sessionId = randomUUID();
		const expiresAt = Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60;
		const tokens = await this.signPair(userId, sessionId, expiresAt);
		await this.sessions.create({
			id: sessionId,
			userId,
			tokenHash: this.digest(tokens.refreshToken),
			expiresAt: new Date(expiresAt * 1000),
		});
		this.logger.log({ event: "session_created", userId, sessionId });
		return tokens;
	}
	async refreshSession(token: string): Promise<TokenPair> {
		let payload: z.infer<typeof refreshPayloadSchema>;
		try {
			payload = refreshPayloadSchema.parse(
				await this.jwtService.verifyAsync(token, {
					algorithms: ["RS256"],
					issuer: env.JWT_ISSUER,
					audience: env.JWT_AUDIENCE,
				}),
			);
		} catch {
			throw new InvalidCredentialsError();
		}
		const tokens = await this.signPair(payload.sub, payload.sid, payload.exp);
		const result = await this.sessions.rotate(
			payload.sid,
			payload.sub,
			this.digest(token),
			this.digest(tokens.refreshToken),
		);
		if (result !== "rotated") {
			if (result === "replay")
				this.logger.warn({
					event: "refresh_replay",
					userId: payload.sub,
					sessionId: payload.sid,
				});
			throw new InvalidCredentialsError();
		}
		this.logger.log({ event: "session_refreshed", sessionId: payload.sid });
		return tokens;
	}
	async revokeSession(userId: string, sessionId: string): Promise<void> {
		await this.sessions.revoke(sessionId, userId);
		this.logger.log({ event: "session_revoked", userId, sessionId });
	}
	private async signPair(
		sub: string,
		sid: string,
		exp: number,
	): Promise<TokenPair> {
		const [accessToken, refreshToken] = await Promise.all([
			this.jwtService.signAsync({ sub, sid, tokenUse: "access" }),
			this.jwtService.signAsync(
				{ sub, sid, jti: randomUUID(), tokenUse: "refresh" },
				{ expiresIn: exp - Math.floor(Date.now() / 1000) },
			),
		]);
		return { accessToken, refreshToken, tokenType: "Bearer" };
	}
	private digest(token: string): string {
		return createHash("sha256").update(token).digest("hex");
	}
}
