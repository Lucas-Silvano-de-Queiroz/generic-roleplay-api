import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { User } from "modules/identity/domain/entities/user.entity";
import { UserRepository } from "modules/identity/domain/repositories/user.repository";
import { Email } from "modules/identity/domain/value-objects/email.vo";
import { db } from "modules/shared/infrastructure/database/drizzle";
import { users } from "../schema/users.schema";

@Injectable()
export class DrizzleUserRepositoryPostgreSQL implements UserRepository {
	async deleteById(userId: string): Promise<void> {
		await db.delete(users).where(eq(users.id, userId));
	}

	async findById(userId: string): Promise<User | null> {
		const result = await db
			.select()
			.from(users)
			.where(eq(users.id, userId))
			.limit(1);

		const user = result[0];

		if (!user) {
			return null;
		}

		return User.restore({
			id: user.id,
			name: user.name,
			email: Email.create(user.email),
			passwordHash: user.passwordHash,
		});
	}

	async save(user: User): Promise<void> {
		await db
			.insert(users)
			.values({
				id: user.id,
				name: user.name,
				email: user.email.value,
				passwordHash: user.passwordHash,
			})
			.onConflictDoNothing({ target: users.email });
	}

	async findByEmail(email: Email): Promise<User | null> {
		const result = await db
			.select()
			.from(users)
			.where(eq(users.email, email.value))
			.limit(1);

		const user = result[0];

		if (!user) {
			return null;
		}

		return User.restore({
			id: user.id,
			name: user.name,
			email: Email.create(user.email),
			passwordHash: user.passwordHash,
		});
	}
}
