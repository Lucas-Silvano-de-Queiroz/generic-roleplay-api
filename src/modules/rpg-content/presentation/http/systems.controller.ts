import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
} from "@nestjs/common";
import {
	ApiCookieAuth,
	ApiNoContentResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import {
	type AuthenticatedUser,
	CurrentUser,
} from "modules/shared/presentation/decorators/current-user.decorator";
import { ZodValidationPipe } from "modules/shared/presentation/pipes/zod-validation.pipe";
import { SystemsService } from "../../application/systems.service";
import {
	type CreateSystem,
	createSystemSchema,
	type UpdateSystem,
	updateSystemSchema,
} from "../../domain/content.schemas";
import {
	ApiContentBody,
	ApiContentErrors,
	ApiContentResponse,
} from "./content.openapi";

@Controller("rpg-systems")
@ApiTags("RPG Systems")
@ApiCookieAuth("cookieAuth")
@ApiContentErrors()
export class SystemsController {
	constructor(private readonly systems: SystemsService) {}

	@Post()
	@ApiOperation({ summary: "Criar sistema de RPG privado" })
	@ApiContentBody("CreateRpgSystemRequest")
	@ApiContentResponse("RpgSystem", 201)
	create(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(createSystemSchema)) input: CreateSystem,
	) {
		return this.systems.create(user.id, input);
	}

	@Get()
	@ApiOperation({ summary: "Listar sistemas do usuário autenticado" })
	@ApiContentResponse("RpgSystem", 200, true)
	list(@CurrentUser() user: AuthenticatedUser) {
		return this.systems.list(user.id);
	}

	@Get(":systemId")
	@ApiOperation({ summary: "Consultar sistema próprio" })
	@ApiContentResponse("RpgSystem")
	get(
		@CurrentUser() user: AuthenticatedUser,
		@Param("systemId", new ParseUUIDPipe()) id: string,
	) {
		return this.systems.get(user.id, id);
	}

	@Patch(":systemId")
	@ApiOperation({ summary: "Atualizar parcialmente sistema próprio" })
	@ApiContentBody("UpdateRpgSystemRequest")
	@ApiContentResponse("RpgSystem")
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param("systemId", new ParseUUIDPipe()) id: string,
		@Body(new ZodValidationPipe(updateSystemSchema)) input: UpdateSystem,
	) {
		return this.systems.update(user.id, id, input);
	}

	@Delete(":systemId")
	@HttpCode(204)
	@ApiOperation({
		summary: "Excluir sistema e suas coleções/templates em cascata",
		description:
			"Exclui em cascata as coleções, templates e registros preenchidos descendentes.",
	})
	@ApiNoContentResponse()
	delete(
		@CurrentUser() user: AuthenticatedUser,
		@Param("systemId", new ParseUUIDPipe()) id: string,
	) {
		return this.systems.delete(user.id, id);
	}
}
