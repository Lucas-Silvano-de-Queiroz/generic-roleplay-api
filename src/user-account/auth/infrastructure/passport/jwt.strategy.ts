import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { env } from "@shared/config/env";
import { ExtractJwt, Strategy } from "passport-jwt";

interface JwtPayload {
	sub: string;
}

export interface AuthenticatedUser {
	id: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	constructor() {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

			secretOrKey: Buffer.from(env.JWT_PUBLIC_KEY_BASE64, "base64").toString(
				"utf-8",
			),

			algorithms: ["RS256"],
		});
	}

	validate(payload: JwtPayload): AuthenticatedUser {
		if (!payload.sub) {
			throw new UnauthorizedException();
		}

		return {
			id: payload.sub,
		};
	}
}
