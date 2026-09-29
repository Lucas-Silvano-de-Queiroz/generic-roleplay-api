import { Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import {
	ApiBadRequestResponse,
	ApiInternalServerErrorResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTooManyRequestsResponse,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { LoginUseCase } from "modules/identity/application/usecases/login.use-case";
import { RefreshAccessTokenUseCase } from "modules/identity/application/usecases/refresh-access-token.use-case";
import { LoginRateLimitGuard } from "modules/identity/infrastructure/auth/login-rate-limit.guard";
import { HTTP_CODE } from "modules/shared/presentation/constants/http-codes";
import { Public } from "modules/shared/presentation/decorators/public.decorator";
import { ApiErrorResponseDto } from "modules/shared/presentation/dto/api-error-response.dto";
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
	@ApiOkResponse({ type: LoginResponseDto, description: "Autenticação concluída." })
	@ApiBadRequestResponse({
		type: ApiErrorResponseDto,
		description: "Dados inválidos.",
		example: {
			statusCode: 400,
			message: "Validation failed",
			details: [{ field: "email", message: "Invalid email address" }],
		},
	})
	@ApiUnauthorizedResponse({
		type: ApiErrorResponseDto,
		description: "E-mail ou senha incorretos.",
		example: { statusCode: 401, message: "Invalid credentials" },
	})
	@ApiTooManyRequestsResponse({
		type: ApiErrorResponseDto,
		description: "Limite de tentativas excedido. Aguarde 15 minutos.",
		headers: {
			"Retry-After": {
				description: "Segundos até que uma nova tentativa seja permitida.",
				schema: { type: "integer" },
			},
		},
		example: {
			statusCode: 429,
			message: "Too many login attempts. Try again later.",
		},
	})
	@ApiInternalServerErrorResponse({
		type: ApiErrorResponseDto,
		description: "Falha inesperada.",
		example: { statusCode: 500, message: "Internal Server Error" },
	})
	login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
		return this.loginUseCase.execute(dto);
	}

	@Public()
	@Post("refresh")
	@HttpCode(HTTP_CODE.OK)
	@ApiOperation({ summary: "Obter um novo access token" })
	@ApiOkResponse({
		type: RefreshTokenResponseDto,
		description: "Novo access token emitido; o refresh token atual permanece válido.",
	})
	@ApiBadRequestResponse({
		type: ApiErrorResponseDto,
		description: "Refresh token ausente.",
		example: {
			statusCode: 400,
			message: "Validation failed",
			details: [{ field: "refreshToken", message: "Refresh token is required" }],
		},
	})
	@ApiUnauthorizedResponse({
		type: ApiErrorResponseDto,
		description: "Refresh token inválido, expirado ou associado a conta inexistente.",
		example: { statusCode: 401, message: "Invalid credentials" },
	})
	@ApiInternalServerErrorResponse({
		type: ApiErrorResponseDto,
		description: "Falha inesperada.",
		example: { statusCode: 500, message: "Internal Server Error" },
	})
	refresh(
		@Body(new ZodValidationPipe(refreshTokenSchema)) dto: RefreshTokenRequestDto,
	) {
		return this.refreshAccessTokenUseCase.execute(dto);
	}
}
