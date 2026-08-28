import { User } from "modules/identity/domain/entities/user.entity";
import { Email } from "modules/identity/domain/value-objects/email.vo";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserNotFoundError } from "../errors/user-not-found.error";
import { DeleteUserUseCase } from "./delete-user.use-case";

describe("DeleteUserUseCase", () => {
	let sut: DeleteUserUseCase;

	const userRepository = {
		findByEmail: vi.fn(),
		save: vi.fn(),
		findById: vi.fn(),
		deleteById: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();

		sut = new DeleteUserUseCase(userRepository);
	});

	it("should delete a user", async () => {
		const existingUser = User.restore({
			id: "user-id",
			name: "John Doe",
			email: Email.create("john@example.com"),
			passwordHash: "hashed-password",
		});

		userRepository.findById.mockResolvedValue(existingUser);

		await sut.execute({ userId: "user-id" });

		expect(userRepository.findById).toHaveBeenCalledWith("user-id");
		expect(userRepository.deleteById).toHaveBeenCalledTimes(1);
		expect(userRepository.deleteById).toHaveBeenCalledWith("user-id");
	});

	it("should throw UserNotFoundError when user does not exist", async () => {
		userRepository.findById.mockResolvedValue(null);

		await expect(sut.execute({ userId: "user-id" })).rejects.toBeInstanceOf(
			UserNotFoundError,
		);

		expect(userRepository.findById).toHaveBeenCalledWith("user-id");
		expect(userRepository.deleteById).not.toHaveBeenCalled();
	});
});
