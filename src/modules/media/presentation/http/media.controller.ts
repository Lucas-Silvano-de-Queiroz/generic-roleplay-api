import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Query,
	Req,
} from "@nestjs/common";
import {
	ApiBody,
	ApiCookieAuth,
	ApiCreatedResponse,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
} from "@nestjs/swagger";
import type { Request } from "express";
import type { AuthenticatedUser } from "modules/shared/presentation/decorators/current-user.decorator";
import { CurrentUser } from "modules/shared/presentation/decorators/current-user.decorator";
import { ZodValidationPipe } from "modules/shared/presentation/pipes/zod-validation.pipe";
import { MediaService } from "../../application/media.service";
import {
	completeBodySchema,
	patchMediaSchema,
	type ReserveUpload,
	reserveUploadSchema,
} from "../../domain/media.schemas";

@Controller()
@ApiTags("Private media")
@ApiCookieAuth("cookieAuth")
export class MediaController {
	constructor(private readonly media: MediaService) {}

	@Post("media/uploads")
	@Header("Cache-Control", "no-store")
	@ApiOperation({ summary: "Reservar upload de imagem privada" })
	@ApiBody({
		schema: {
			type: "object",
			required: [
				"destination",
				"fileName",
				"contentType",
				"sizeBytes",
				"checksumSha256",
			],
			properties: {
				destination: {
					type: "object",
					description:
						"Destino discriminado: system-cover, collection-cover ou record-image",
				},
				fileName: { type: "string", maxLength: 255 },
				contentType: {
					type: "string",
					enum: ["image/jpeg", "image/png", "image/webp"],
				},
				sizeBytes: { type: "integer", minimum: 1, maximum: 10485760 },
				checksumSha256: {
					type: "string",
					description: "SHA-256 Base64 canônico",
				},
				alt: { type: "string", maxLength: 500 },
			},
			additionalProperties: false,
		},
	})
	@ApiCreatedResponse({
		description: "Autorização temporária para PUT direto ao storage",
	})
	reserve(
		@CurrentUser() user: AuthenticatedUser,
		@Body(new ZodValidationPipe(reserveUploadSchema)) input: ReserveUpload,
		@Query() query: Record<string, unknown>,
	) {
		this.assertNoQuery(query);
		return this.media.reserve(user.id, input);
	}

	@Post("media/:mediaId/complete")
	@Header("Cache-Control", "no-store")
	@ApiOperation({ summary: "Validar, reencodar e publicar imagem enviada" })
	@ApiOkResponse({ description: "Imagem privada pronta" })
	complete(
		@CurrentUser() user: AuthenticatedUser,
		@Param("mediaId", new ParseUUIDPipe()) id: string,
		@Body(new ZodValidationPipe(completeBodySchema)) _body: unknown,
		@Query() query: Record<string, unknown>,
	) {
		this.assertNoQuery(query);
		return this.media.complete(user.id, id);
	}

	@Get("media/:mediaId/access")
	@Header("Cache-Control", "no-store")
	@ApiOperation({ summary: "Emitir URL GET temporária para imagem pronta" })
	@ApiOkResponse({ description: "URL temporária e expiração" })
	access(
		@CurrentUser() user: AuthenticatedUser,
		@Param("mediaId", new ParseUUIDPipe()) id: string,
		@Query() query: Record<string, unknown>,
	) {
		this.assertNoQuery(query);
		return this.media.access(user.id, id);
	}

	@Patch("media/:mediaId")
	@Header("Cache-Control", "no-store")
	@ApiOperation({ summary: "Atualizar texto alternativo de imagem" })
	@ApiOkResponse({ description: "Imagem atualizada" })
	updateAlt(
		@CurrentUser() user: AuthenticatedUser,
		@Param("mediaId", new ParseUUIDPipe()) id: string,
		@Body(new ZodValidationPipe(patchMediaSchema)) input: { alt: string },
		@Query() query: Record<string, unknown>,
	) {
		this.assertNoQuery(query);
		return this.media.updateAlt(user.id, id, input.alt);
	}

	@Delete("media/:mediaId")
	@HttpCode(204)
	@ApiNoContentResponse()
	@Header("Cache-Control", "no-store")
	@ApiOperation({ summary: "Remover imagem própria ou cancelar upload" })
	async remove(
		@CurrentUser() user: AuthenticatedUser,
		@Param("mediaId", new ParseUUIDPipe()) id: string,
		@Req() request: Request,
		@Query() query: Record<string, unknown>,
	): Promise<void> {
		this.assertNoQuery(query);
		if (request.body !== undefined) {
			throw new BadRequestException("Validation failed");
		}
		await this.media.remove(user.id, id);
	}

	@Get("rpg-systems/:systemId/cover")
	@Header("Cache-Control", "no-store")
	@ApiOperation({ summary: "Consultar capa de sistema próprio" })
	@ApiOkResponse({ description: "Capa atual ou null" })
	getSystemCover(
		@CurrentUser() user: AuthenticatedUser,
		@Param("systemId", new ParseUUIDPipe()) id: string,
		@Query() query: Record<string, unknown>,
	) {
		this.assertNoQuery(query);
		return this.media.cover(user.id, "system-cover", id);
	}

	@Get("rpg-collections/:collectionId/cover")
	@Header("Cache-Control", "no-store")
	@ApiOperation({ summary: "Consultar capa de coleção própria" })
	@ApiOkResponse({ description: "Capa atual ou null" })
	getCollectionCover(
		@CurrentUser() user: AuthenticatedUser,
		@Param("collectionId", new ParseUUIDPipe()) id: string,
		@Query() query: Record<string, unknown>,
	) {
		this.assertNoQuery(query);
		return this.media.cover(user.id, "collection-cover", id);
	}

	@Get("rpg-records/:recordId/images")
	@Header("Cache-Control", "no-store")
	@ApiOperation({ summary: "Consultar galeria de registro próprio" })
	@ApiOkResponse({ description: "Galeria ordenada de imagens prontas" })
	getRecordImages(
		@CurrentUser() user: AuthenticatedUser,
		@Param("recordId", new ParseUUIDPipe()) id: string,
		@Query() query: Record<string, unknown>,
	) {
		this.assertNoQuery(query);
		return this.media.recordImages(user.id, id);
	}

	private assertNoQuery(query: Record<string, unknown>): void {
		if (Object.keys(query ?? {}).length > 0) {
			throw new BadRequestException("Validation failed");
		}
	}
}
