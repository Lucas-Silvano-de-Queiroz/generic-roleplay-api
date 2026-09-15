import { Body, Controller, Delete, HttpCode, Post } from "@nestjs/common";
import { CreateUserUseCase } from "modules/identity/application/usecases/create-user.use-case";
import { DeleteUserUseCase } from "modules/identity/application/usecases/delete-user.use-case";
import { HTTP_CODE } from "modules/shared/presentation/constants/http-codes";
import {
	type AuthenticatedUser,
	CurrentUser,
} from "modules/shared/presentation/decorators/current-user.decorator";
import { Public } from "modules/shared/presentation/decorators/public.decorator";
import { ZodValidationPipe } from "modules/shared/presentation/pipes/zod-validation.pipe";
import {
	CreateUserRequestDto,
	CreateUserResponseDto,
	createUserSchema,
} from "../dto/create-user.dto";
import { DeleteUserRequestDto, deleteUserSchema } from "../dto/delete-user.dto";

@Controller("users")
export class UserController {
	constructor(
		private readonly createUserUseCase: CreateUserUseCase,
		private readonly deleteUserUseCase: DeleteUserUseCase,
	) {}

	@Public()
	@Post()
	@HttpCode(HTTP_CODE.CREATED)
	create(
		@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserRequestDto,
	): Promise<CreateUserResponseDto> {
		return this.createUserUseCase.execute(dto);
	}

	@Delete("me")
	@HttpCode(HTTP_CODE.NO_CONTENT)
	async delete(
		@Body(new ZodValidationPipe(deleteUserSchema)) dto: DeleteUserRequestDto,
		@CurrentUser() user: AuthenticatedUser,
	): Promise<void> {
		await this.deleteUserUseCase.execute({
			userId: user.id,
			password: dto.password,
		});
	}
}
