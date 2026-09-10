import { Inject, Injectable } from "@nestjs/common";
import type { UserRepository } from "modules/identity/domain/repositories/user.repository";
import { USER_REPOSITORY } from "modules/identity/domain/repositories/user.repository.token";
import type { HashServiceContract } from "../contracts/hash-service.contract";
import { HASH_SERVICE_CONTRACT } from "../contracts/hash-service.contract.token";
import { InvalidCredentialsError } from "../errors/invalid-credentials.error";
import { UserNotFoundError } from "../errors/user-not-found.error";

interface DeleteUserInput {
	userId: string;
	password: string;
}

@Injectable()
export class DeleteUserUseCase {
	constructor(
		@Inject(USER_REPOSITORY)
		private readonly usersRepository: UserRepository,

		@Inject(HASH_SERVICE_CONTRACT)
		private readonly hashService: HashServiceContract,
	) {}
	async execute(input: DeleteUserInput): Promise<void> {
		const existingUser = await this.usersRepository.findById(input.userId);

		if (!existingUser) {
			throw new UserNotFoundError();
		}

		const passwordMatches = await this.hashService.comparePassword(
			input.password,
			existingUser.passwordHash,
		);

		if (!passwordMatches) {
			throw new InvalidCredentialsError();
		}

		await this.usersRepository.deleteById(existingUser.id);
	}
}
