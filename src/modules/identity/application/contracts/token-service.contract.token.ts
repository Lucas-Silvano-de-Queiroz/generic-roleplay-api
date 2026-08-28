export interface AccessTokenPayload {
	sub: string;
}

export interface TokenServiceContract {
	sign(payload: AccessTokenPayload): string;
}
