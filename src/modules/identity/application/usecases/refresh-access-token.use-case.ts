import { Inject, Injectable } from "@nestjs/common";
import { TOKEN_SERVICE_CONTRACT } from "../contracts/token-service.contract";
import type {
	TokenPair,
	TokenServiceContract,
} from "../contracts/token-service.contract.token";
export interface RefreshAccessTokenInput {
	readonly refreshToken: string;
}
export type RefreshAccessTokenOutput = TokenPair;
@Injectable()
export class RefreshAccessTokenUseCase {
	constructor(
		@Inject(TOKEN_SERVICE_CONTRACT)
		private readonly tokenService: TokenServiceContract,
	) {}
	execute(input: RefreshAccessTokenInput): Promise<RefreshAccessTokenOutput> {
		return this.tokenService.refreshSession(input.refreshToken);
	}
}
