import { Body, Controller, Post } from "@nestjs/common";
import { LoginUseCase } from "modules/identity/application/usecases/login.use-case";
import { Public } from "modules/shared/presentation/decorators/public.decorator";
import { LoginDto } from "../dto/login.dto";

@Controller("auth")
export class AuthenticationController {
	constructor(private readonly loginUseCase: LoginUseCase) {}

	@Public()
	@Post("login")
	login(@Body() dto: LoginDto) {
		return this.loginUseCase.execute(dto);
	}
}
