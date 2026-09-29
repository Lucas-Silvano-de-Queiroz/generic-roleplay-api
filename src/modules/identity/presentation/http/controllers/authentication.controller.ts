import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { LoginUseCase } from "modules/identity/application/usecases/login.use-case";
import { RefreshAccessTokenUseCase } from "modules/identity/application/usecases/refresh-access-token.use-case";
import { LoginRateLimitGuard } from "modules/identity/infrastructure/auth/login-rate-limit.guard";
import { HTTP_CODE } from "modules/shared/presentation/constants/http-codes";
import {
	ApiLoginErrorResponses,
	ApiRefreshErrorResponses,
} from "modules/shared/presentation/decorators/api-error-responses.decorator";
import { Public } from "modules/shared/presentation/decorators/public.decorator";
import { ZodValidationPipe } from "modules/shared/presentation/pipes/zod-validation.pipe";
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
	) {}

	@Public()
	@Post("login")
	@HttpCode(HTTP_CODE.OK)
	@UseGuards(LoginRateLimitGuard)
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
		description:
			"Novo access token emitido; o refresh token atual permanece válido.",
	})
	@ApiRefreshErrorResponses()
	refresh(
		@Body(new ZodValidationPipe(refreshTokenSchema))
		dto: RefreshTokenRequestDto,
	) {
		return this.refreshAccessTokenUseCase.execute(dto);
	}
}
