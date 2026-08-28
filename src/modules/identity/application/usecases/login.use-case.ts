import { Inject, Injectable } from "@nestjs/common";
import type { HashServiceContract } from "modules/identity/application/contracts/hash-service.contract";
import { HASH_SERVICE_CONTRACT } from "modules/identity/application/contracts/hash-service.contract.token";
import type { IdentityCredentialsReader } from "modules/identity/application/contracts/identity-credentials.contract";
import { IDENTITY_CREDENTIALS_READER } from "modules/identity/application/contracts/identity-credentials-reader.token";
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
}

@Injectable()
export class LoginUseCase {
	constructor(
		@Inject(IDENTITY_CREDENTIALS_READER)
		private readonly identityCredentialsReader: IdentityCredentialsReader,

		@Inject(HASH_SERVICE_CONTRACT)
		private readonly hashService: HashServiceContract,

		@Inject(TOKEN_SERVICE_CONTRACT)
		private readonly tokenService: TokenServiceContract,
	) {}

	async execute(input: LoginInput): Promise<LoginOutput> {
		const email = Email.create(input.email);

		const credentials =
			await this.identityCredentialsReader.findCredentialsByEmail(email);

		if (!credentials) {
			throw new InvalidCredentialsError();
		}

		const passwordMatches = await this.hashService.comparePassword(
			input.password,
			credentials.passwordHash,
		);

		if (!passwordMatches) {
			throw new InvalidCredentialsError();
		}

		const accessToken = this.tokenService.sign({
			sub: credentials.userId,
		});

		return {
			accessToken,
		};
	}
}
