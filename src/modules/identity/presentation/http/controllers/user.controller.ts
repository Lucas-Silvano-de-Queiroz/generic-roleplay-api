import { Body, Controller, Delete, HttpCode, Post } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiCreatedResponse,
	ApiNoContentResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import { CreateUserUseCase } from "modules/identity/application/usecases/create-user.use-case";
import { DeleteUserUseCase } from "modules/identity/application/usecases/delete-user.use-case";
import { HTTP_CODE } from "modules/shared/presentation/constants/http-codes";
import {
	ApiCreateUserErrorResponses,
	ApiDeleteUserErrorResponses,
} from "modules/shared/presentation/decorators/api-error-responses.decorator";
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
@ApiTags("Users")
export class UserController {
	constructor(
		private readonly createUserUseCase: CreateUserUseCase,
		private readonly deleteUserUseCase: DeleteUserUseCase,
	) {}

	@Public()
	@Post()
	@HttpCode(HTTP_CODE.CREATED)
	@ApiOperation({ summary: "Criar uma conta de usuário" })
	@ApiCreatedResponse({
		type: CreateUserResponseDto,
		description: "Conta criada com sucesso.",
	})
	@ApiCreateUserErrorResponses()
	create(
		@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserRequestDto,
	): Promise<CreateUserResponseDto> {
		return this.createUserUseCase.execute(dto);
	}

	@Delete("me")
	@HttpCode(HTTP_CODE.NO_CONTENT)
	@ApiBearerAuth()
	@ApiOperation({
		summary: "Excluir a conta autenticada",
		description:
			"Exclui em cascata todos os sistemas, coleções, templates e registros preenchidos da conta, além das sessões.",
	})
	@ApiNoContentResponse({ description: "Conta excluída com sucesso." })
	@ApiDeleteUserErrorResponses()
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
