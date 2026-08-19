import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { TokenServiceContract } from "user-account/auth/application/contracts/token-service.contract.token";

export type AccessTokenPayload = {
	sub: string;
};

@Injectable()
export class JwtTokenService implements TokenServiceContract {
	constructor(private readonly jwtService: JwtService) {}

	sign(payload: AccessTokenPayload): string {
		return this.jwtService.sign(payload);
	}
}
