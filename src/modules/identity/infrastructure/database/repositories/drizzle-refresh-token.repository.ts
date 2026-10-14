import { Injectable } from "@nestjs/common";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../../../../shared/infrastructure/database/drizzle";
import type {
	RefreshTokenRecord,
	RefreshTokenRepository,
} from "../../../domain/repositories/refresh-token.repository";
import { refreshTokens } from "../schema/refresh-tokens.schema";

@Injectable()
export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
	async create(token: RefreshTokenRecord): Promise<void> {
		await db.insert(refreshTokens).values(token);
	}

	async rotate(
		previousHash: string,
		next: RefreshTokenRecord,
	): Promise<boolean> {
		return db.transaction(async (tx) => {
			const [consumed] = await tx
				.delete(refreshTokens)
				.where(
					and(
						eq(refreshTokens.tokenHash, previousHash),
						eq(refreshTokens.userId, next.userId),
						gt(refreshTokens.expiresAt, sql`now()`),
					),
				)
				.returning({ tokenHash: refreshTokens.tokenHash });
			if (!consumed) return false;
			await tx.insert(refreshTokens).values(next);
			return true;
		});
	}

	async revoke(tokenHash: string, userId: string): Promise<void> {
		await db
			.delete(refreshTokens)
			.where(
				and(
					eq(refreshTokens.tokenHash, tokenHash),
					eq(refreshTokens.userId, userId),
				),
			);
	}
}
