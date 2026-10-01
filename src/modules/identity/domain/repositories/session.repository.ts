export const SESSION_REPOSITORY = Symbol("SESSION_REPOSITORY");
export interface SessionRecord {
	id: string;
	userId: string;
	tokenHash: string;
	expiresAt: Date;
}
export interface SessionRepository {
	create(session: SessionRecord): Promise<void>;
	rotate(
		id: string,
		userId: string,
		previousHash: string,
		nextHash: string,
	): Promise<"rotated" | "replay" | "invalid">;
	isActive(id: string, userId: string): Promise<boolean>;
	revoke(id: string, userId: string): Promise<void>;
}
