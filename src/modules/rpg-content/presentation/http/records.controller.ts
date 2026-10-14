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
	Query,
} from "@nestjs/common";
import {
	ApiCookieAuth,
	ApiNoContentResponse,
	ApiOperation,
	ApiQuery,
	ApiTags,
} from "@nestjs/swagger";
import {
	type AuthenticatedUser,
	CurrentUser,
} from "modules/shared/presentation/decorators/current-user.decorator";
import { ZodValidationPipe } from "modules/shared/presentation/pipes/zod-validation.pipe";
import { RecordsService } from "../../application/records.service";
import {
	type CreateRecord,
	createRecordSchema,
	type ListRecordsQuery,
	listRecordsQuerySchema,
	type UpdateRecord,
	updateRecordSchema,
} from "../../domain/records.schemas";
import { ApiContentResponse } from "./content.openapi";
import { ApiRecordBody, ApiRecordErrors } from "./records.openapi";
@Controller()
@ApiTags("RPG Records")
@ApiCookieAuth("cookieAuth")
@ApiRecordErrors()
export class RecordsController {
	constructor(private readonly records: RecordsService) {}
	@Post("rpg-templates/:templateId/records")
	@ApiOperation({
		summary: "Criar registro no template próprio (máximo 1.000)",
		description:
			"values deve satisfazer as keys, required e maxLength do template; categorias não fixam schemas. Nomes repetidos são permitidos.",
	})
	@ApiRecordBody("CreateRecordRequest")
	@ApiContentResponse("RpgRecord", 201)
	create(
		@CurrentUser() user: AuthenticatedUser,
		@Param("templateId", new ParseUUIDPipe()) id: string,
		@Body(new ZodValidationPipe(createRecordSchema)) input: CreateRecord,
	) {
		return this.records.create(user.id, id, input);
	}
	@Get("rpg-templates/:templateId/records")
	@ApiOperation({
		summary: "Listar registros do template próprio",
		description:
			"Ordenação crescente por ID, página com items e nextCursor somente quando houver mais itens. O cursor apenas filtra IDs dentro do template autorizado; parâmetros desconhecidos são rejeitados.",
	})
	@ApiQuery({
		name: "limit",
		required: false,
		schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
	})
	@ApiQuery({
		name: "cursor",
		required: false,
		schema: { type: "string", format: "uuid" },
	})
	@ApiContentResponse("RecordPage")
	list(
		@CurrentUser() user: AuthenticatedUser,
		@Param("templateId", new ParseUUIDPipe()) id: string,
		@Query(new ZodValidationPipe(listRecordsQuerySchema))
		query: ListRecordsQuery,
	) {
		return this.records.list(user.id, id, query);
	}
	@Get("rpg-records/:recordId")
	@ApiOperation({ summary: "Consultar registro com ownership transitivo" })
	@ApiContentResponse("RpgRecord")
	get(
		@CurrentUser() user: AuthenticatedUser,
		@Param("recordId", new ParseUUIDPipe()) id: string,
	) {
		return this.records.get(user.id, id);
	}
	@Patch("rpg-records/:recordId")
	@ApiOperation({
		summary: "Atualizar registro",
		description:
			"values enviado substitui o objeto inteiro e deve satisfazer o template atual. Omitir values preserva os valores. PATCH vazio ou semanticamente igual preserva updatedAt. Opcionais omitidos na substituição são removidos; null é inválido. createdAt é preservado.",
	})
	@ApiRecordBody("UpdateRecordRequest")
	@ApiContentResponse("RpgRecord")
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param("recordId", new ParseUUIDPipe()) id: string,
		@Body(new ZodValidationPipe(updateRecordSchema)) input: UpdateRecord,
	) {
		return this.records.update(user.id, id, input);
	}
	@Delete("rpg-records/:recordId")
	@HttpCode(204)
	@ApiOperation({
		summary: "Excluir registro",
		description:
			"Remove apenas este registro. Excluir template, coleção, sistema ou conta remove os registros descendentes em cascata.",
	})
	@ApiNoContentResponse()
	delete(
		@CurrentUser() user: AuthenticatedUser,
		@Param("recordId", new ParseUUIDPipe()) id: string,
	) {
		return this.records.delete(user.id, id);
	}
}
