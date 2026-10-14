export const REFRESH_TOKEN_REPOSITORY = Symbol("REFRESH_TOKEN_REPOSITORY");

export interface RefreshTokenRecord {
	tokenHash: string;
	userId: string;
	expiresAt: Date;
}

export interface RefreshTokenRepository {
	create(token: RefreshTokenRecord): Promise<void>;
	rotate(previousHash: string, next: RefreshTokenRecord): Promise<boolean>;
	revoke(tokenHash: string, userId: string): Promise<void>;
}
