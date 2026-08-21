import {
	Body,
	Controller,
	Delete,
	HttpCode,
	Post,
	UsePipes,
} from "@nestjs/common";
import { Public } from "@shared/presentation/decorators/public.decorator";
import { ZodValidationPipe } from "@shared/presentation/pipes/zod-validation.pipe";
import { CreateUserUseCase } from "user-account/identity/application/usecases/create-user.use-case";
import { DeleteUserUseCase } from "user-account/identity/application/usecases/delete-user.use-case";
import {
	CreateUserRequestDto,
	createUserSchema,
} from "user-account/identity/presentation/http/dto/create-user.dto";
import { DeleteUserRequestDto, deleteUserSchema } from "../dto/delete-user.dto";

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

	@Delete()
	@HttpCode(204)
	@UsePipes(new ZodValidationPipe(deleteUserSchema))
	async delete(@Body() dto: DeleteUserRequestDto): Promise<void> {
		await this.deleteUserUseCase.execute(dto);
	}
}
