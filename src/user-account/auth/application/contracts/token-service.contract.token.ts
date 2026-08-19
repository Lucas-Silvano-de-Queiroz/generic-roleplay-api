import { AccessTokenPayload } from "user-account/auth/infrastructure/auth/jwt-token.service";

export interface TokenServiceContract {
	sign(payload: AccessTokenPayload): string;
}
