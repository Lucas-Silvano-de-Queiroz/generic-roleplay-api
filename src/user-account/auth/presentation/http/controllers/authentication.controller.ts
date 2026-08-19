import { Body, Controller, Post } from "@nestjs/common";
import { Public } from "@shared/presentation/decorators/public.decorator";
import { LoginUseCase } from "../../../application/usecases/login.use-case";
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
