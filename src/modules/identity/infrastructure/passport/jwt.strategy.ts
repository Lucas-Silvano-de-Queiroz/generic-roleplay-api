import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { env } from "modules/shared/config/env";
import {
	accessCookieName,
	readAuthCookie,
} from "modules/shared/infrastructure/auth/auth-cookies";
import type { AuthenticatedUser } from "modules/shared/presentation/decorators/current-user.decorator";
import { Strategy } from "passport-jwt";
import { z } from "zod";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor() {
		super({
			jwtFromRequest: (request) => readAuthCookie(request, accessCookieName()),

			secretOrKey: Buffer.from(env.JWT_PUBLIC_KEY_BASE64, "base64").toString(
				"utf-8",
			),

			algorithms: ["RS256"],
			issuer: env.JWT_ISSUER,
			audience: env.JWT_AUDIENCE,
		});
	}

	validate(payload: unknown): AuthenticatedUser {
		const parsed = z
			.object({
				sub: z.uuid(),
				exp: z.number().int().positive(),
				tokenUse: z.literal("access"),
			})
			.safeParse(payload);
		if (!parsed.success) {
			throw new UnauthorizedException();
		}

		return {
			id: parsed.data.sub,
		};
	}
}
