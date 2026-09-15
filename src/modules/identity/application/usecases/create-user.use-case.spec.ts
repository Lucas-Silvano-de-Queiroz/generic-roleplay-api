import { User } from "modules/identity/domain/entities/user.entity";
import type { UserRepository } from "modules/identity/domain/repositories/user.repository";
import { Email } from "modules/identity/domain/value-objects/email.vo";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HashServiceContract } from "../contracts/hash-service.contract";
import { UserAlreadyExistsError } from "../errors/user-already-exists.error";
import { CreateUserUseCase } from "./create-user.use-case";

describe("CreateUserUseCase", () => {
	let sut: CreateUserUseCase;

	const userRepository = {
		findByEmail: vi.fn(),
		create: vi.fn(),
	};

	const hashService = {
		hashPassword: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();

		sut = new CreateUserUseCase(
			userRepository as unknown as UserRepository,
			hashService as unknown as HashServiceContract,
		);
	});

	it("should create a user", async () => {
		userRepository.findByEmail.mockResolvedValue(null);
		userRepository.create.mockResolvedValue(true);
		hashService.hashPassword.mockResolvedValue("hashed-password");

		const result = await sut.execute({
			name: "John Doe",
			email: "john@example.com",
			password: "123456",
		});

		expect(userRepository.findByEmail).toHaveBeenCalledWith(
			Email.create("john@example.com"),
		);
		expect(hashService.hashPassword).toHaveBeenCalledWith("123456");

		const savedUser = userRepository.create.mock.calls[0][0];

		expect(savedUser).toBeInstanceOf(User);
		expect(savedUser.name).toBe("John Doe");
		expect(savedUser.email.value).toBe("john@example.com");
		expect(savedUser.passwordHash).toBe("hashed-password");
		expect(savedUser.passwordHash).not.toBe("123456");

		expect(result.id).toBe(savedUser.id);
	});

	it("should throw UserAlreadyExistsError when email already exists", async () => {
		const existingUser = User.create({
			name: "Existing User",
			email: Email.create("john@example.com"),
			passwordHash: "hashed-password",
		});

		userRepository.findByEmail.mockResolvedValue(existingUser);

		await expect(
			sut.execute({
				name: "John Doe",
				email: "john@example.com",
				password: "123456",
			}),
		).rejects.toBeInstanceOf(UserAlreadyExistsError);

		expect(userRepository.findByEmail).toHaveBeenCalledWith(
			Email.create("john@example.com"),
		);

		expect(hashService.hashPassword).not.toHaveBeenCalled();
		expect(userRepository.create).not.toHaveBeenCalled();
	});

	it("should throw UserAlreadyExistsError when save conflicts (race condition)", async () => {
		userRepository.findByEmail.mockResolvedValue(null);
		userRepository.create.mockResolvedValue(false);
		hashService.hashPassword.mockResolvedValue("hashed-password");

		await expect(
			sut.execute({
				name: "John Doe",
				email: "john@example.com",
				password: "123456",
			}),
		).rejects.toBeInstanceOf(UserAlreadyExistsError);

		expect(userRepository.create).toHaveBeenCalled();
	});
});
