import { Injectable } from "@nestjs/common";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../../../../shared/infrastructure/database/drizzle";
import type {
	SessionRecord,
	SessionRepository,
} from "../../../domain/repositories/session.repository";
import { sessions } from "../schema/sessions.schema";
@Injectable()
export class DrizzleSessionRepository implements SessionRepository {
	async create(session: SessionRecord): Promise<void> {
		await db.insert(sessions).values(session);
	}
	async rotate(
		id: string,
		userId: string,
		previousHash: string,
		nextHash: string,
	): Promise<"rotated" | "replay" | "invalid"> {
		return db.transaction(async (tx) => {
			const [session] = await tx
				.select()
				.from(sessions)
				.where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
				.for("update");
			if (
				!session ||
				session.revoked ||
				session.expiresAt.getTime() <= Date.now()
			)
				return "invalid";
			if (session.tokenHash !== previousHash) {
				await tx
					.update(sessions)
					.set({ revoked: true })
					.where(eq(sessions.id, id));
				// Return instead of throwing so that revocation commits.
				return "replay";
			}
			await tx
				.update(sessions)
				.set({ tokenHash: nextHash })
				.where(eq(sessions.id, id));
			return "rotated";
		});
	}
	async isActive(id: string, userId: string): Promise<boolean> {
		const [session] = await db
			.select({ id: sessions.id })
			.from(sessions)
			.where(
				and(
					eq(sessions.id, id),
					eq(sessions.userId, userId),
					eq(sessions.revoked, false),
					gt(sessions.expiresAt, sql`now()`),
				),
			)
			.limit(1);
		return !!session;
	}
	async revoke(id: string, userId: string): Promise<void> {
		await db
			.update(sessions)
			.set({ revoked: true })
			.where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
	}
}
