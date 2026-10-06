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
	REFRESH_TOKEN_REPOSITORY,
	type RefreshTokenRepository,
} from "../../domain/repositories/refresh-token.repository";

const refreshPayloadSchema = z.object({
	sub: z.uuid(),
	jti: z.uuid(),
	tokenUse: z.literal("refresh"),
	exp: z.number().int().positive(),
});
@Injectable()
export class JwtTokenService implements TokenServiceContract {
	private readonly logger = new Logger(JwtTokenService.name);
	constructor(
		private readonly jwtService: JwtService,
		@Inject(REFRESH_TOKEN_REPOSITORY)
		private readonly refreshTokenRepository: RefreshTokenRepository,
	) {}
	async issueTokens(userId: string): Promise<TokenPair> {
		const expiresAt = Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60;
		const tokens = await this.signPair(userId, expiresAt);
		await this.refreshTokenRepository.create({
			userId,
			tokenHash: this.digest(tokens.refreshToken),
			expiresAt: new Date(expiresAt * 1000),
		});
		this.logger.log({ event: "tokens_issued", userId });
		return tokens;
	}
	private async verifyRefreshToken(token: string) {
		try {
			return refreshPayloadSchema.parse(
				await this.jwtService.verifyAsync(token, {
					algorithms: ["RS256"],
					issuer: env.JWT_ISSUER,
					audience: env.JWT_AUDIENCE,
				}),
			);
		} catch {
			throw new InvalidCredentialsError();
		}
	}
	async refreshTokens(token: string): Promise<TokenPair> {
		const payload = await this.verifyRefreshToken(token);
		const tokens = await this.signPair(payload.sub, payload.exp);
		const rotated = await this.refreshTokenRepository.rotate(
			this.digest(token),
			{
				userId: payload.sub,
				tokenHash: this.digest(tokens.refreshToken),
				expiresAt: new Date(payload.exp * 1000),
			},
		);
		if (!rotated) {
			this.logger.warn({ event: "refresh_rejected", userId: payload.sub });
			throw new InvalidCredentialsError();
		}
		this.logger.log({ event: "tokens_refreshed", userId: payload.sub });
		return tokens;
	}
	async revokeRefreshToken(token: string): Promise<void> {
		const payload = await this.verifyRefreshToken(token);
		await this.refreshTokenRepository.revoke(this.digest(token), payload.sub);
		this.logger.log({ event: "refresh_token_revoked", userId: payload.sub });
	}
	private async signPair(sub: string, exp: number): Promise<TokenPair> {
		const [accessToken, refreshToken] = await Promise.all([
			this.jwtService.signAsync({ sub, tokenUse: "access" }),
			this.jwtService.signAsync(
				{ sub, jti: randomUUID(), tokenUse: "refresh" },
				{ expiresIn: exp - Math.floor(Date.now() / 1000) },
			),
		]);
		return { accessToken, refreshToken, tokenType: "Bearer" };
	}
	private digest(token: string): string {
		return createHash("sha256").update(token).digest("hex");
	}
}
