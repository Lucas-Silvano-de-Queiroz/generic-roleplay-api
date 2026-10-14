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
import { TemplatesService } from "../../application/templates.service";
import {
	type CreateTemplate,
	createTemplateSchema,
	type UpdateTemplate,
	updateTemplateSchema,
} from "../../domain/content.schemas";
import {
	ApiContentBody,
	ApiContentErrors,
	ApiContentResponse,
} from "./content.openapi";

@Controller()
@ApiTags("RPG Templates")
@ApiCookieAuth("cookieAuth")
@ApiContentErrors()
export class TemplatesController {
	constructor(private readonly templates: TemplatesService) {}

	@Post("rpg-collections/:collectionId/templates")
	@ApiOperation({ summary: "Criar template na coleção própria (máximo 100)" })
	@ApiContentBody("CreateTemplateRequest")
	@ApiContentResponse("RpgTemplate", 201)
	create(
		@CurrentUser() user: AuthenticatedUser,
		@Param("collectionId", new ParseUUIDPipe()) id: string,
		@Body(new ZodValidationPipe(createTemplateSchema)) input: CreateTemplate,
	) {
		return this.templates.create(user.id, id, input);
	}

	@Get("rpg-collections/:collectionId/templates")
	@ApiOperation({ summary: "Listar templates da coleção própria" })
	@ApiContentResponse("RpgTemplate", 200, true)
	list(
		@CurrentUser() user: AuthenticatedUser,
		@Param("collectionId", new ParseUUIDPipe()) id: string,
	) {
		return this.templates.list(user.id, id);
	}

	@Get("rpg-templates/:templateId")
	@ApiOperation({ summary: "Consultar template com ownership transitivo" })
	@ApiContentResponse("RpgTemplate")
	get(
		@CurrentUser() user: AuthenticatedUser,
		@Param("templateId", new ParseUUIDPipe()) id: string,
	) {
		return this.templates.get(user.id, id);
	}

	@Patch("rpg-templates/:templateId")
	@ApiOperation({
		summary:
			"Atualizar template; fields enviado substitui a definição completa",
		description:
			"Alterações que invalidem registros existentes retornam 409 com rollback integral. Nenhum valor é apagado, truncado ou preenchido automaticamente.",
	})
	@ApiContentBody("UpdateTemplateRequest")
	@ApiContentResponse("RpgTemplate")
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param("templateId", new ParseUUIDPipe()) id: string,
		@Body(new ZodValidationPipe(updateTemplateSchema)) input: UpdateTemplate,
	) {
		return this.templates.update(user.id, id, input);
	}

	@Delete("rpg-templates/:templateId")
	@HttpCode(204)
	@ApiOperation({
		summary: "Excluir template e suas definições de campos",
		description:
			"Exclui em cascata todos os registros preenchidos deste template.",
	})
	@ApiNoContentResponse()
	delete(
		@CurrentUser() user: AuthenticatedUser,
		@Param("templateId", new ParseUUIDPipe()) id: string,
	) {
		return this.templates.delete(user.id, id);
	}
}
