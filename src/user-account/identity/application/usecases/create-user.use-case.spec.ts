import { User } from "user-account/identity/domain/entities/user.entity";
import { Email } from "user-account/identity/domain/value-objects/email.vo";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserAlreadyExistsError } from "../errors/user-already-exists.error";
import { CreateUserUseCase } from "./create-user.use-case";

describe("CreateUserUseCase", () => {
	let sut: CreateUserUseCase;

	const userRepository = {
		findByEmail: vi.fn(),
		save: vi.fn(),
		findById: vi.fn(),
		deleteById: vi.fn(),
	};

	const hashService = {
		hashPassword: vi.fn(),
		comparePassword: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();

		sut = new CreateUserUseCase(userRepository, hashService);
	});

	it("should create a user", async () => {
		userRepository.findByEmail.mockResolvedValue(null);
		hashService.hashPassword.mockResolvedValue("hashed-password");

		const result = await sut.execute({
			name: "John Doe",
			email: "john@example.com",
			password: "123456",
		});

		expect(result.id).toBeDefined();

		expect(userRepository.findByEmail).toHaveBeenCalledWith(
			Email.create("john@example.com"),
		);

		expect(hashService.hashPassword).toHaveBeenCalledWith("123456");

		expect(userRepository.save).toHaveBeenCalledTimes(1);

		const savedUser = userRepository.save.mock.calls[0][0];

		expect(savedUser).toBeInstanceOf(User);
		expect(savedUser.name).toBe("John Doe");
		expect(savedUser.email.value).toBe("john@example.com");
		expect(savedUser.passwordHash).toBe("hashed-password");
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
		expect(userRepository.save).not.toHaveBeenCalled();
	});

	it("should save the hashed password", async () => {
		userRepository.findByEmail.mockResolvedValue(null);
		hashService.hashPassword.mockResolvedValue("hashed-password");

		await sut.execute({
			name: "John Doe",
			email: "john@example.com",
			password: "123456",
		});

		const savedUser = userRepository.save.mock.calls[0][0];

		expect(savedUser.passwordHash).toBe("hashed-password");
		expect(savedUser.passwordHash).not.toBe("123456");
	});
});
