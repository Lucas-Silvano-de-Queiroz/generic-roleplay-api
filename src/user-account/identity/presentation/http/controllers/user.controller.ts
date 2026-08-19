import { Body, Controller, HttpCode, Post, UsePipes } from "@nestjs/common";
import { Public } from "@shared/presentation/decorators/public.decorator";
import { ZodValidationPipe } from "@shared/presentation/pipes/zod-validation.pipe";
import { CreateUserUseCase } from "user-account/identity/application/usecases/create-user.use-case";
import {
	CreateUserRequestDto,
	createUserSchema,
} from "user-account/identity/presentation/http/dto/create-user.dto";

@Controller("users")
export class UserController {
	constructor(private readonly createUserUseCase: CreateUserUseCase) {}

	@Public()
	@Post()
	@HttpCode(201)
	@UsePipes(new ZodValidationPipe(createUserSchema))
	create(
		@Body()
		dto: CreateUserRequestDto,
	) {
		return this.createUserUseCase.execute(dto);
	}
}
