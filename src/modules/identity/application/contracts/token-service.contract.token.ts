export interface AccessTokenPayload {
	sub: string;
}
export interface TokenPair {
	accessToken: string;
	refreshToken: string;
	tokenType: "Bearer";
}
export interface TokenServiceContract {
	issueTokens(userId: string): Promise<TokenPair>;
	refreshTokens(token: string): Promise<TokenPair>;
	revokeRefreshToken(token: string): Promise<void>;
}
