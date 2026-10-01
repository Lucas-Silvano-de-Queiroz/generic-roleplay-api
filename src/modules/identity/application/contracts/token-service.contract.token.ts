export interface AccessTokenPayload {
	sub: string;
	sid: string;
}
export interface TokenPair {
	accessToken: string;
	refreshToken: string;
	tokenType: "Bearer";
}
export interface TokenServiceContract {
	createSession(userId: string): Promise<TokenPair>;
	refreshSession(token: string): Promise<TokenPair>;
	revokeSession(userId: string, sessionId: string): Promise<void>;
}
