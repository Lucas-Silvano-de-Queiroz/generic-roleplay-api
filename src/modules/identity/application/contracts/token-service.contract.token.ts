export interface AccessTokenPayload {
	sub: string;
}

export interface TokenServiceContract {
	signAccessToken(payload: AccessTokenPayload): string;
	signRefreshToken(payload: AccessTokenPayload): string;
	verifyRefreshToken(token: string): AccessTokenPayload;
}
