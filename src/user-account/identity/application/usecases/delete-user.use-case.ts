import { Inject, Injectable } from "@nestjs/common";
import type { UserRepository } from "user-account/identity/domain/repositories/user.repository";
import { USER_REPOSITORY } from "user-account/identity/domain/repositories/user.repository.token";
import { UserNotFoundError } from "../errors/user-not-found.error";

interface DeleteUserInput {
	userId: string;
}

@Injectable()
export class DeleteUserUseCase {
	constructor(
		@Inject(USER_REPOSITORY)
		private readonly usersRepository: UserRepository,
	) {}
	async execute(input: DeleteUserInput): Promise<void> {
		const existingUser = await this.usersRepository.findById(input.userId);

		if (!existingUser) {
			throw new UserNotFoundError();
		}

		await this.usersRepository.deleteById(existingUser.id);
	}
}
