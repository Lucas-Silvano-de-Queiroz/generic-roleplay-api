import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { User } from "user-account/identity/domain/entities/user.entity";
import { UserRepository } from "user-account/identity/domain/repositories/user.repository";
import { Email } from "user-account/identity/domain/value-objects/email.vo";
import { db } from "../drizzle";
import { users } from "../schema/users.schema";

@Injectable()
export class DrizzleUserRepositoryPostgreSQL implements UserRepository {
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
