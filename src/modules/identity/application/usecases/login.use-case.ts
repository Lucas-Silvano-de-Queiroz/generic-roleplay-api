import { Inject, Injectable } from "@nestjs/common";
import type { HashServiceContract } from "modules/identity/application/contracts/hash-service.contract";
import { HASH_SERVICE_CONTRACT } from "modules/identity/application/contracts/hash-service.contract.token";
import type { UserRepository } from "modules/identity/domain/repositories/user.repository";
import { USER_REPOSITORY } from "modules/identity/domain/repositories/user.repository.token";
import { Email } from "modules/identity/domain/value-objects/email.vo";
import { TOKEN_SERVICE_CONTRACT } from "../contracts/token-service.contract";
import type { TokenServiceContract } from "../contracts/token-service.contract.token";
import { InvalidCredentialsError } from "../errors/invalid-credentials.error";

export interface LoginInput {
	readonly email: string;
	readonly password: string;
}

export interface LoginOutput {
	readonly accessToken: string;
	readonly refreshToken: string;
	readonly tokenType: "Bearer";
}

@Injectable()
export class LoginUseCase {
	constructor(
		@Inject(USER_REPOSITORY)
		private readonly userRepository: UserRepository,

		@Inject(HASH_SERVICE_CONTRACT)
		private readonly hashService: HashServiceContract,

		@Inject(TOKEN_SERVICE_CONTRACT)
		private readonly tokenService: TokenServiceContract,
	) {}

	async execute(input: LoginInput): Promise<LoginOutput> {
		const email = Email.create(input.email);

		const user = await this.userRepository.findByEmail(email);

		const passwordMatches = await this.hashService.comparePassword(
			input.password,
			user?.passwordHash ?? null,
		);

		if (!user || !passwordMatches) {
			throw new InvalidCredentialsError();
		}

		return this.tokenService.createSession(user.id);
	}
}
