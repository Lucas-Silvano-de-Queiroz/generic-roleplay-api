import { Inject, Injectable } from "@nestjs/common";
import { User } from "user-account/identity/domain/entities/user.entity";
import type { UserRepository } from "user-account/identity/domain/repositories/user.repository";
import { USER_REPOSITORY } from "user-account/identity/domain/repositories/user.repository.token";
import { Email } from "user-account/identity/domain/value-objects/email.vo";
import type { HashServiceContract } from "../contracts/hash-service.contract";
import { HASH_SERVICE_CONTRACT } from "../contracts/hash-service.contract.token";
import { UserAlreadyExistsError } from "../errors/user-already-exists.error";

export interface CreateUserInput {
	readonly name: string;
	readonly email: string;
	readonly password: string;
}

export interface CreateUserOutput {
	readonly id: string;
}

@Injectable()
export class CreateUserUseCase {
	constructor(
		@Inject(USER_REPOSITORY)
		private readonly userRepository: UserRepository,

		@Inject(HASH_SERVICE_CONTRACT)
		private readonly hashService: HashServiceContract,
	) {}

	async execute(input: CreateUserInput): Promise<CreateUserOutput> {
		const email = Email.create(input.email);

		const existingUser = await this.userRepository.findByEmail(email);

		if (existingUser) {
			throw new UserAlreadyExistsError();
		}

		const passwordHash = await this.hashService.hashPassword(input.password);

		const user = User.create({
			name: input.name,
			email,
			passwordHash,
		});

		await this.userRepository.save(user);

		return {
			id: user.id,
		};
	}
}
