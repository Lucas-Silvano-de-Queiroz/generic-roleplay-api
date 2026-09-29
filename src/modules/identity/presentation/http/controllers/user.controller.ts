import { Body, Controller, Delete, HttpCode, Post } from "@nestjs/common";
import {
	ApiBearerAuth,
	ApiBadRequestResponse,
	ApiConflictResponse,
	ApiCreatedResponse,
	ApiInternalServerErrorResponse,
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CreateUserUseCase } from "modules/identity/application/usecases/create-user.use-case";
import { DeleteUserUseCase } from "modules/identity/application/usecases/delete-user.use-case";
import { HTTP_CODE } from "modules/shared/presentation/constants/http-codes";
import {
	type AuthenticatedUser,
	CurrentUser,
} from "modules/shared/presentation/decorators/current-user.decorator";
import { Public } from "modules/shared/presentation/decorators/public.decorator";
import { ApiErrorResponseDto } from "modules/shared/presentation/dto/api-error-response.dto";
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
	@ApiBadRequestResponse({
		type: ApiErrorResponseDto,
		description: "Dados inválidos.",
		example: {
			statusCode: 400,
			message: "Validation failed",
			details: [{ field: "email", message: "Invalid email address" }],
		},
	})
	@ApiConflictResponse({
		type: ApiErrorResponseDto,
		description: "Já existe uma conta com esse e-mail.",
		example: { statusCode: 409, message: "User already exists" },
	})
	@ApiInternalServerErrorResponse({
		type: ApiErrorResponseDto,
		description: "Falha inesperada.",
		example: { statusCode: 500, message: "Internal Server Error" },
	})
	create(
		@Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserRequestDto,
	): Promise<CreateUserResponseDto> {
		return this.createUserUseCase.execute(dto);
	}

	@Delete("me")
	@HttpCode(HTTP_CODE.NO_CONTENT)
	@ApiBearerAuth()
	@ApiOperation({ summary: "Excluir a conta autenticada" })
	@ApiNoContentResponse({ description: "Conta excluída com sucesso." })
	@ApiBadRequestResponse({
		type: ApiErrorResponseDto,
		description: "Senha ausente ou inválida.",
		example: {
			statusCode: 400,
			message: "Validation failed",
			details: [{ field: "password", message: "Password must be at least 8 characters" }],
		},
	})
	@ApiUnauthorizedResponse({
		type: ApiErrorResponseDto,
		description: "Token ausente, inválido ou senha incorreta.",
		example: { statusCode: 401, message: "Unauthorized" },
	})
	@ApiNotFoundResponse({
		type: ApiErrorResponseDto,
		description: "Usuário do token não foi encontrado.",
		example: { statusCode: 404, message: "User not found" },
	})
	@ApiInternalServerErrorResponse({
		type: ApiErrorResponseDto,
		description: "Falha inesperada.",
		example: { statusCode: 500, message: "Internal Server Error" },
	})
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
