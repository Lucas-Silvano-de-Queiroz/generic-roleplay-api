import { User } from "modules/identity/domain/entities/user.entity";
import { Email } from "modules/identity/domain/value-objects/email.vo";
import { DrizzleUserRepositoryPostgreSQL } from "modules/identity/infrastructure/database/repositories/drizzle-user.repository-postgresql";
import { afterAll, describe, expect, it } from "vitest";

describe("DrizzleUserRepositoryPostgreSQL (integration)", () => {
	const sut = new DrizzleUserRepositoryPostgreSQL();

	const createdUserIds: string[] = [];

	function makeUser(email: string): User {
		return User.create({
			name: "John Doe",
			email: Email.create(email),
			passwordHash: "hashed-password",
		});
	}

	afterAll(async () => {
		for (const id of createdUserIds) {
			await sut.deleteById(id);
		}
	});

	it("should persist a user and restore it by id", async () => {
		const user = makeUser(`repo-create-${Date.now()}@example.com`);

		const created = await sut.create(user);

		expect(created).toBe(true);

		createdUserIds.push(user.id);

		const found = await sut.findById(user.id);

		expect(found).toBeInstanceOf(User);
		expect(found?.id).toBe(user.id);
		expect(found?.name).toBe(user.name);
		expect(found?.email.value).toBe(user.email.value);
		expect(found?.passwordHash).toBe(user.passwordHash);
	});

	it("should return false when creating a user with an email that already exists", async () => {
		const email = `repo-duplicated-${Date.now()}@example.com`;
		const first = makeUser(email);

		await sut.create(first);

		createdUserIds.push(first.id);

		const duplicated = makeUser(email);

		const created = await sut.create(duplicated);

		expect(created).toBe(false);

		const stillExists = await sut.findByEmail(Email.create(email));

		expect(stillExists?.id).toBe(first.id);
	});

	it("should find a user by email", async () => {
		const email = `repo-by-email-${Date.now()}@example.com`;
		const user = makeUser(email);

		await sut.create(user);

		createdUserIds.push(user.id);

		const found = await sut.findByEmail(Email.create(email));

		expect(found?.id).toBe(user.id);
	});

	it("should return null when the email does not exist", async () => {
		const found = await sut.findByEmail(
			Email.create(`repo-missing-${Date.now()}@example.com`),
		);

		expect(found).toBeNull();
	});

	it("should return null when the id does not exist", async () => {
		const found = await sut.findById(crypto.randomUUID());

		expect(found).toBeNull();
	});

	it("should delete a user by id", async () => {
		const user = makeUser(`repo-delete-${Date.now()}@example.com`);

		await sut.create(user);

		await sut.deleteById(user.id);

		const found = await sut.findById(user.id);

		expect(found).toBeNull();
	});
});
