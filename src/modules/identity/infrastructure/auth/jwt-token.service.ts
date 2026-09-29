import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
	AccessTokenPayload,
	TokenServiceContract,
} from "modules/identity/application/contracts/token-service.contract.token";
import { env } from "modules/shared/config/env";

@Injectable()
export class JwtTokenService implements TokenServiceContract {
	constructor(private readonly jwtService: JwtService) {}

	signAccessToken(payload: AccessTokenPayload): string {
		return this.jwtService.sign({ ...payload, tokenUse: "access" });
	}

	signRefreshToken(payload: AccessTokenPayload): string {
		return this.jwtService.sign(
			{ ...payload, tokenUse: "refresh" },
			{ expiresIn: env.JWT_REFRESH_EXPIRES_IN },
		);
	}

	verifyRefreshToken(token: string): AccessTokenPayload {
		const payload = this.jwtService.verify<{
			sub?: unknown;
			tokenUse?: unknown;
		}>(token);

		if (
			typeof payload.sub !== "string" ||
			payload.sub.length === 0 ||
			payload.tokenUse !== "refresh"
		) {
			throw new Error("Invalid refresh token");
		}

		return { sub: payload.sub };
	}
}
