import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import { LoginUseCase } from "modules/identity/application/usecases/login.use-case";
import { RefreshAccessTokenUseCase } from "modules/identity/application/usecases/refresh-access-token.use-case";
import { HTTP_CODE } from "modules/shared/presentation/constants/http-codes";
import {
	ApiLoginErrorResponses,
	ApiRefreshErrorResponses,
} from "modules/shared/presentation/decorators/api-error-responses.decorator";
import { Public } from "modules/shared/presentation/decorators/public.decorator";
import { ZodValidationPipe } from "modules/shared/presentation/pipes/zod-validation.pipe";
import {
	type AuthenticatedUser,
	CurrentUser,
} from "../../../../shared/presentation/decorators/current-user.decorator";

import { TOKEN_SERVICE_CONTRACT } from "../../../application/contracts/token-service.contract";
import type { TokenServiceContract } from "../../../application/contracts/token-service.contract.token";
import { LoginDto, LoginResponseDto, loginSchema } from "../dto/login.dto";
import {
	RefreshTokenRequestDto,
	RefreshTokenResponseDto,
	refreshTokenSchema,
} from "../dto/refresh-token.dto";
@Controller("auth")
@ApiTags("Authentication")
export class AuthenticationController {
	constructor(
		private readonly loginUseCase: LoginUseCase,
		private readonly refreshAccessTokenUseCase: RefreshAccessTokenUseCase,
		@Inject(TOKEN_SERVICE_CONTRACT)
		private readonly tokenService: TokenServiceContract,
	) {}

	@Public()
	@Post("login")
	@HttpCode(HTTP_CODE.OK)
	@ApiOperation({ summary: "Autenticar e obter um token de acesso" })
	@ApiOkResponse({
		type: LoginResponseDto,
		description: "Autenticação concluída.",
	})
	@ApiLoginErrorResponses()
	login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
		return this.loginUseCase.execute(dto);
	}

	@Public()
	@Post("refresh")
	@HttpCode(HTTP_CODE.OK)
	@ApiOperation({ summary: "Obter um novo access token" })
	@ApiOkResponse({
		type: RefreshTokenResponseDto,
		description: "Novos tokens emitidos; o refresh anterior é invalidado.",
	})
	@ApiRefreshErrorResponses()
	refresh(
		@Body(new ZodValidationPipe(refreshTokenSchema))
		dto: RefreshTokenRequestDto,
	) {
		return this.refreshAccessTokenUseCase.execute(dto);
	}
	@Post("logout")
	@HttpCode(204)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Revogar a sessão autenticada" })
	@ApiNoContentResponse({ description: "Sessão revogada." })
	async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
		await this.tokenService.revokeSession(user.id, user.sessionId);
	}
}
