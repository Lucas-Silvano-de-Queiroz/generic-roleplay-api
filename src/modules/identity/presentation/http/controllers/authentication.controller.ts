import {
	Body,
	Controller,
	HttpCode,
	Inject,
	Post,
	Req,
	Res,
} from "@nestjs/common";
import {
	ApiCookieAuth,
	ApiNoContentResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { LoginUseCase } from "modules/identity/application/usecases/login.use-case";
import { RefreshAccessTokenUseCase } from "modules/identity/application/usecases/refresh-access-token.use-case";
import {
	clearAuthCookies,
	readAuthCookie,
	refreshCookieName,
	requireRefreshCookie,
	writeAuthCookies,
} from "modules/shared/infrastructure/auth/auth-cookies";
import { HTTP_CODE } from "modules/shared/presentation/constants/http-codes";
import {
	ApiLoginErrorResponses,
	ApiRefreshErrorResponses,
} from "modules/shared/presentation/decorators/api-error-responses.decorator";
import { Public } from "modules/shared/presentation/decorators/public.decorator";
import { ZodValidationPipe } from "modules/shared/presentation/pipes/zod-validation.pipe";
import { TOKEN_SERVICE_CONTRACT } from "../../../application/contracts/token-service.contract";
import type { TokenServiceContract } from "../../../application/contracts/token-service.contract.token";
import { LoginDto, loginSchema } from "../dto/login.dto";
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
	@HttpCode(HTTP_CODE.NO_CONTENT)
	@ApiOperation({
		summary: "Autenticar e definir cookies HttpOnly de access e refresh",
	})
	@ApiNoContentResponse({
		description: "Autenticação concluída; JWTs enviados somente em Set-Cookie.",
	})
	@ApiLoginErrorResponses()
	async login(
		@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
		@Res({ passthrough: true }) response: Response,
	): Promise<void> {
		writeAuthCookies(response, await this.loginUseCase.execute(dto));
	}

	@Public()
	@Post("refresh")
	@ApiCookieAuth("refreshCookieAuth")
	@HttpCode(HTTP_CODE.NO_CONTENT)
	@ApiOperation({
		summary: "Renovar os cookies HttpOnly usando o cookie de refresh",
	})
	@ApiNoContentResponse({
		description: "Cookies renovados; o refresh anterior é invalidado.",
	})
	@ApiRefreshErrorResponses()
	async refresh(
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response,
	): Promise<void> {
		const tokens = await this.refreshAccessTokenUseCase.execute({
			refreshToken: requireRefreshCookie(request),
		});
		writeAuthCookies(response, tokens);
	}
	@Public()
	@Post("logout")
	@ApiCookieAuth("refreshCookieAuth")
	@HttpCode(204)
	@ApiOperation({
		summary: "Revogar o refresh token do cookie e limpar os cookies",
	})
	@ApiNoContentResponse({
		description:
			"Refresh token revogado; access tokens continuam válidos até expirar.",
	})
	@ApiRefreshErrorResponses(true)
	async logout(
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response,
	): Promise<void> {
		clearAuthCookies(response);
		const token = readAuthCookie(request, refreshCookieName());
		if (token) await this.tokenService.revokeRefreshToken(token);
	}
}
