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

@Controller("users")
export class UserController {
	constructor(
		private readonly createUserUseCase: CreateUserUseCase,
		private readonly deleteUserUseCase: DeleteUserUseCase,
	) {}

	@Public()
	@Post()
	@HttpCode(HTTP_CODE.CREATED)
	@UsePipes(new ZodValidationPipe(createUserSchema))
	create(@Body() dto: CreateUserRequestDto): Promise<CreateUserResponseDto> {
		return this.createUserUseCase.execute(dto);
	}

	@Delete("me")
	@HttpCode(HTTP_CODE.NO_CONTENT)
	async delete(@CurrentUser() user: AuthenticatedUser): Promise<void> {
		await this.deleteUserUseCase.execute({ userId: user.id });
	}
}
