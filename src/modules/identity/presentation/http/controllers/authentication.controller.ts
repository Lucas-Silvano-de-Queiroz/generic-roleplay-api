import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { LoginUseCase } from "modules/identity/application/usecases/login.use-case";
import { HTTP_CODE } from "modules/shared/presentation/constants/http-codes";
import { Public } from "modules/shared/presentation/decorators/public.decorator";
import { ZodValidationPipe } from "modules/shared/presentation/pipes/zod-validation.pipe";
import { LoginDto, loginSchema } from "../dto/login.dto";

@Controller("auth")
export class AuthenticationController {
	constructor(private readonly loginUseCase: LoginUseCase) {}

	@Public()
	@Post("login")
	@HttpCode(HTTP_CODE.OK)
	login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
		return this.loginUseCase.execute(dto);
	}
}
