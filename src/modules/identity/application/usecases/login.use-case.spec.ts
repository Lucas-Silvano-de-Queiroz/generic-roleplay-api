import { User } from "modules/identity/domain/entities/user.entity";
import type { UserRepository } from "modules/identity/domain/repositories/user.repository";
import { Email } from "modules/identity/domain/value-objects/email.vo";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HashServiceContract } from "../contracts/hash-service.contract";
import type { TokenServiceContract } from "../contracts/token-service.contract.token";
import { InvalidCredentialsError } from "../errors/invalid-credentials.error";
import { LoginUseCase } from "./login.use-case";

describe("LoginUseCase", () => {
	let sut: LoginUseCase;

	const userRepository = {
		findByEmail: vi.fn(),
	};

	const hashService = {
		comparePassword: vi.fn(),
	};

	const tokenService = {
		issueTokens: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();

		sut = new LoginUseCase(
			userRepository as unknown as UserRepository,
			hashService as unknown as HashServiceContract,
			tokenService as unknown as TokenServiceContract,
		);
	});

	it("should return an access token on valid credentials", async () => {
		const existingUser = User.restore({
			id: "user-id",
			name: "John Doe",
			email: Email.create("john@example.com"),
			passwordHash: "hashed-password",
		});

		userRepository.findByEmail.mockResolvedValue(existingUser);
		hashService.comparePassword.mockResolvedValue(true);
		tokenService.issueTokens.mockResolvedValue({
			accessToken: "jwt-token",
			refreshToken: "refresh-jwt-token",
			tokenType: "Bearer",
		});

		const result = await sut.execute({
			email: "john@example.com",
			password: "password",
		});

		expect(result.accessToken).toBe("jwt-token");
		expect(result.refreshToken).toBe("refresh-jwt-token");
		expect(userRepository.findByEmail).toHaveBeenCalledWith(
			Email.create("john@example.com"),
		);
		expect(hashService.comparePassword).toHaveBeenCalledWith(
			"password",
			"hashed-password",
		);
		expect(tokenService.issueTokens).toHaveBeenCalledWith("user-id");
	});

	it("should throw InvalidCredentialsError when user does not exist", async () => {
		userRepository.findByEmail.mockResolvedValue(null);

		await expect(
			sut.execute({
				email: "john@example.com",
				password: "password",
			}),
		).rejects.toBeInstanceOf(InvalidCredentialsError);

		expect(hashService.comparePassword).toHaveBeenCalledWith("password", null);
		expect(tokenService.issueTokens).not.toHaveBeenCalled();
	});

	it("should throw InvalidCredentialsError when password does not match", async () => {
		const existingUser = User.restore({
			id: "user-id",
			name: "John Doe",
			email: Email.create("john@example.com"),
			passwordHash: "hashed-password",
		});

		userRepository.findByEmail.mockResolvedValue(existingUser);
		hashService.comparePassword.mockResolvedValue(false);

		await expect(
			sut.execute({
				email: "john@example.com",
				password: "wrong-password",
			}),
		).rejects.toBeInstanceOf(InvalidCredentialsError);

		expect(tokenService.issueTokens).not.toHaveBeenCalled();
	});
});
