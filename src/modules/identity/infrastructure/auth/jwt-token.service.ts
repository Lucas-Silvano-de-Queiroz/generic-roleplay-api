import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
	AccessTokenPayload,
	TokenServiceContract,
} from "modules/identity/application/contracts/token-service.contract.token";

@Injectable()
export class JwtTokenService implements TokenServiceContract {
	constructor(private readonly jwtService: JwtService) {}

	sign(payload: AccessTokenPayload): string {
		return this.jwtService.sign(payload);
	}
}
