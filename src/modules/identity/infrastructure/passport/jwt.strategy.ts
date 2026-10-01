import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { env } from "modules/shared/config/env";
import { ExtractJwt, Strategy } from "passport-jwt";

import { z } from "zod";
import {
	SESSION_REPOSITORY,
	type SessionRepository,
} from "../../domain/repositories/session.repository";

interface JwtPayload {
	sid: string;
	exp: number;
	sub: string;
	tokenUse: "access";
}

export interface AuthenticatedUser {
	id: string;
	sessionId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor(
		@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

			secretOrKey: Buffer.from(env.JWT_PUBLIC_KEY_BASE64, "base64").toString(
				"utf-8",
			),

			algorithms: ["RS256"],
			issuer: env.JWT_ISSUER,
			audience: env.JWT_AUDIENCE,
		});
	}

	async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
		const parsed = z
			.object({
				sub: z.uuid(),
				sid: z.uuid(),
				exp: z.number().int().positive(),
				tokenUse: z.literal("access"),
			})
			.safeParse(payload);
		if (
			!parsed.success ||
			!(await this.sessions.isActive(parsed.data.sid, parsed.data.sub))
		) {
			throw new UnauthorizedException();
		}

		return {
			id: payload.sub,
			sessionId: payload.sid,
		};
	}
}
