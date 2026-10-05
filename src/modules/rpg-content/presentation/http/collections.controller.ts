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
	ApiBearerAuth,
	ApiNoContentResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import {
	type AuthenticatedUser,
	CurrentUser,
} from "modules/shared/presentation/decorators/current-user.decorator";
import { ZodValidationPipe } from "modules/shared/presentation/pipes/zod-validation.pipe";
import { CollectionsService } from "../../application/collections.service";
import {
	type CreateCollection,
	createCollectionSchema,
	type UpdateCollection,
	updateCollectionSchema,
} from "../../domain/content.schemas";
import {
	ApiContentBody,
	ApiContentErrors,
	ApiContentResponse,
} from "./content.openapi";

@Controller()
@ApiTags("RPG Collections")
@ApiBearerAuth()
@ApiContentErrors()
export class CollectionsController {
	constructor(private readonly collections: CollectionsService) {}

	@Post("rpg-systems/:systemId/collections")
	@ApiOperation({ summary: "Criar coleção no sistema próprio (máximo 100)" })
	@ApiContentBody("CreateCollectionRequest")
	@ApiContentResponse("RpgCollection", 201)
	create(
		@CurrentUser() user: AuthenticatedUser,
		@Param("systemId", new ParseUUIDPipe()) id: string,
		@Body(new ZodValidationPipe(createCollectionSchema))
		input: CreateCollection,
	) {
		return this.collections.create(user.id, id, input);
	}

	@Get("rpg-systems/:systemId/collections")
	@ApiOperation({ summary: "Listar coleções do sistema próprio" })
	@ApiContentResponse("RpgCollection", 200, true)
	list(
		@CurrentUser() user: AuthenticatedUser,
		@Param("systemId", new ParseUUIDPipe()) id: string,
	) {
		return this.collections.list(user.id, id);
	}

	@Get("rpg-collections/:collectionId")
	@ApiOperation({ summary: "Consultar coleção com ownership transitivo" })
	@ApiContentResponse("RpgCollection")
	get(
		@CurrentUser() user: AuthenticatedUser,
		@Param("collectionId", new ParseUUIDPipe()) id: string,
	) {
		return this.collections.get(user.id, id);
	}

	@Patch("rpg-collections/:collectionId")
	@ApiOperation({
		summary: "Atualizar coleção; renomear não altera identifier",
	})
	@ApiContentBody("UpdateCollectionRequest")
	@ApiContentResponse("RpgCollection")
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param("collectionId", new ParseUUIDPipe()) id: string,
		@Body(new ZodValidationPipe(updateCollectionSchema))
		input: UpdateCollection,
	) {
		return this.collections.update(user.id, id, input);
	}

	@Delete("rpg-collections/:collectionId")
	@HttpCode(204)
	@ApiOperation({
		summary: "Excluir coleção e seus templates em cascata",
		description:
			"Exclui em cascata os templates e registros preenchidos descendentes.",
	})
	@ApiNoContentResponse()
	delete(
		@CurrentUser() user: AuthenticatedUser,
		@Param("collectionId", new ParseUUIDPipe()) id: string,
	) {
		return this.collections.delete(user.id, id);
	}
}
