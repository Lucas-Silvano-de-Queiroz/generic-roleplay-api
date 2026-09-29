import { Inject, Injectable } from "@nestjs/common";
import type { UserRepository } from "../../domain/repositories/user.repository";
import { USER_REPOSITORY } from "../../domain/repositories/user.repository.token";
import { TOKEN_SERVICE_CONTRACT } from "../contracts/token-service.contract";
import type { TokenServiceContract } from "../contracts/token-service.contract.token";
import { InvalidCredentialsError } from "../errors/invalid-credentials.error";

export interface RefreshAccessTokenInput {
	readonly refreshToken: string;
}

export interface RefreshAccessTokenOutput {
	readonly accessToken: string;
	readonly tokenType: "Bearer";
}

@Injectable()
export class RefreshAccessTokenUseCase {
	constructor(
		@Inject(USER_REPOSITORY)
		private readonly userRepository: UserRepository,
		@Inject(TOKEN_SERVICE_CONTRACT)
		private readonly tokenService: TokenServiceContract,
	) {}

	async execute(
		input: RefreshAccessTokenInput,
	): Promise<RefreshAccessTokenOutput> {
		let payload: { sub: string };
		try {
			payload = this.tokenService.verifyRefreshToken(input.refreshToken);
		} catch {
			throw new InvalidCredentialsError();
		}

		const user = await this.userRepository.findById(payload.sub);
		if (!user) {
			throw new InvalidCredentialsError();
		}

		return {
			accessToken: this.tokenService.signAccessToken({ sub: user.id }),
			tokenType: "Bearer",
		};
	}
}
