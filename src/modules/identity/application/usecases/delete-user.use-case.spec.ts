import { User } from "modules/identity/domain/entities/user.entity";
import type { UserRepository } from "modules/identity/domain/repositories/user.repository";
import { Email } from "modules/identity/domain/value-objects/email.vo";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HashServiceContract } from "../contracts/hash-service.contract";
import { InvalidCredentialsError } from "../errors/invalid-credentials.error";
import { UserNotFoundError } from "../errors/user-not-found.error";
import { DeleteUserUseCase } from "./delete-user.use-case";

describe("DeleteUserUseCase", () => {
	let sut: DeleteUserUseCase;

	const userRepository = {
		findById: vi.fn(),
		deleteById: vi.fn(),
	};

	const hashService = {
		comparePassword: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();

		sut = new DeleteUserUseCase(
			userRepository as unknown as UserRepository,
			hashService as unknown as HashServiceContract,
		);
	});

	it("should delete a user", async () => {
		const existingUser = User.restore({
			id: "user-id",
			name: "John Doe",
			email: Email.create("john@example.com"),
			passwordHash: "hashed-password",
		});

		userRepository.findById.mockResolvedValue(existingUser);
		hashService.comparePassword.mockResolvedValue(true);

		await sut.execute({ userId: "user-id", password: "password" });

		expect(userRepository.findById).toHaveBeenCalledWith("user-id");
		expect(hashService.comparePassword).toHaveBeenCalledWith(
			"password",
			"hashed-password",
		);
		expect(userRepository.deleteById).toHaveBeenCalledWith("user-id");
	});

	it("should throw UserNotFoundError when user does not exist", async () => {
		userRepository.findById.mockResolvedValue(null);

		await expect(
			sut.execute({ userId: "user-id", password: "password" }),
		).rejects.toBeInstanceOf(UserNotFoundError);

		expect(userRepository.findById).toHaveBeenCalledWith("user-id");
		expect(userRepository.deleteById).not.toHaveBeenCalled();
	});

	it("should throw InvalidCredentialsError when password does not match", async () => {
		const existingUser = User.restore({
			id: "user-id",
			name: "John Doe",
			email: Email.create("john@example.com"),
			passwordHash: "hashed-password",
		});

		userRepository.findById.mockResolvedValue(existingUser);
		hashService.comparePassword.mockResolvedValue(false);

		await expect(
			sut.execute({ userId: "user-id", password: "wrong-password" }),
		).rejects.toBeInstanceOf(InvalidCredentialsError);

		expect(userRepository.findById).toHaveBeenCalledWith("user-id");
		expect(userRepository.deleteById).not.toHaveBeenCalled();
	});
});
