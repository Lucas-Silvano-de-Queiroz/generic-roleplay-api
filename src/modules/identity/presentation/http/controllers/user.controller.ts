import {
	Body,
	Controller,
	Delete,
	HttpCode,
	Post,
	UsePipes,
} from "@nestjs/common";
import { CreateUserUseCase } from "modules/identity/application/usecases/create-user.use-case";
import { DeleteUserUseCase } from "modules/identity/application/usecases/delete-user.use-case";
import {
	type AuthenticatedUser,
	CurrentUser,
} from "modules/shared/presentation/decorators/current-user.decorator";
import { Public } from "modules/shared/presentation/decorators/public.decorator";
import { ZodValidationPipe } from "modules/shared/presentation/pipes/zod-validation.pipe";
import { CreateUserRequestDto, createUserSchema } from "../dto/create-user.dto";

@Controller("users")
export class UserController {
	constructor(
		private readonly createUserUseCase: CreateUserUseCase,
		private readonly deleteUserUseCase: DeleteUserUseCase,
	) {}

	@Public()
	@Post()
	@HttpCode(201)
	@UsePipes(new ZodValidationPipe(createUserSchema))
	create(@Body() dto: CreateUserRequestDto) {
		return this.createUserUseCase.execute(dto);
	}

	@Delete("me")
	@HttpCode(204)
	async delete(@CurrentUser() user: AuthenticatedUser): Promise<void> {
		await this.deleteUserUseCase.execute({ userId: user.id });
	}
}
