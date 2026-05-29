import { Body, Controller, Post } from "@nestjs/common";
import { CreateUserRequestDto } from "@user-system-account/application/dto/create-user.dto";
import { CreateUserUseCase } from "@user-system-account/application/usecases/create-user.use-case";

@Controller("users")
export class UserController {
	constructor(private readonly createUserUseCase: CreateUserUseCase) {}

	@Post()
	create(@Body() dto: CreateUserRequestDto) {
		return this.createUserUseCase.execute(dto);
	}
}
