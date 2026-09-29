export interface AccessTokenPayload {
	sub: string;
}

export interface TokenServiceContract {
	sign(payload: AccessTokenPayload): string;
	signRefreshToken(payload: AccessTokenPayload): string;
	verifyRefreshToken(token: string): AccessTokenPayload;
}
