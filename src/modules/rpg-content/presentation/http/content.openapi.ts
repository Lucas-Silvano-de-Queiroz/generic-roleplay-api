import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiResponse, type OpenAPIObject } from "@nestjs/swagger";
import { ApiErrorResponseDto } from "modules/shared/presentation/dto/api-error-response.dto";
import { z } from "zod";
import {
	createCollectionSchema,
	createSystemSchema,
	createTemplateSchema,
	fieldDefinitionSchema,
	updateCollectionSchema,
	updateSystemSchema,
	updateTemplateSchema,
} from "../../domain/content.schemas";

type OpenApiSchemas = NonNullable<
	NonNullable<OpenAPIObject["components"]>["schemas"]
>;
type SchemaObject = Exclude<OpenApiSchemas[string], { $ref: string }>;

const systemResponse = z.strictObject({
	id: z.uuid(),
	name: z.string().min(1).max(100),
	description: z.string().max(5000).optional(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});
const collectionResponse = systemResponse.extend({
	systemId: z.uuid(),
	identifier: z
		.string()
		.max(64)
		.regex(/^[a-z][a-z0-9_-]*$/),
});
const templateResponse = systemResponse.extend({
	collectionId: z.uuid(),
	identifier: z
		.string()
		.max(64)
		.regex(/^[a-z][a-z0-9_-]*$/),
	category: z.string().max(64).optional(),
	fields: z.array(fieldDefinitionSchema).max(100),
});

// Generate request documentation from the validators to keep limits/defaults in sync.
export function contentOpenApiSchemas(): Record<string, SchemaObject> {
	const contracts = {
		RpgSystem: systemResponse,
		RpgCollection: collectionResponse,
		RpgTemplate: templateResponse,
		FieldDefinition: fieldDefinitionSchema,
		FieldDefinitionInput: fieldDefinitionSchema,
		CreateRpgSystemRequest: createSystemSchema,
		UpdateRpgSystemRequest: updateSystemSchema,
		CreateCollectionRequest: createCollectionSchema,
		UpdateCollectionRequest: updateCollectionSchema,
		CreateTemplateRequest: createTemplateSchema,
		UpdateTemplateRequest: updateTemplateSchema,
	};
	return Object.fromEntries(
		Object.entries(contracts).map(([name, schema]) => {
			const { $schema, ...document } = z.toJSONSchema(schema, {
				target: "openapi-3.0",
				io:
					name.startsWith("Create") ||
					name.startsWith("Update") ||
					name === "FieldDefinitionInput"
						? "input"
						: "output",
			});
			void $schema;
			const result = document as SchemaObject;
			if (result.properties?.fields)
				result.properties.fields = {
					type: "array",
					maxItems: 100,
					items: {
						$ref: `#/components/schemas/${name === "RpgTemplate" ? "FieldDefinition" : "FieldDefinitionInput"}`,
					},
					...(name === "CreateTemplateRequest" ? { default: [] } : {}),
					description:
						"Array ordenado. Em PATCH substitui integralmente a definição; omitir preserva os campos.",
				};
			return [name, result];
		}),
	);
}

export function ApiContentBody(schema: string) {
	return ApiBody({
		schema: { $ref: `#/components/schemas/${schema}` },
		description:
			"Payload estrito: propriedades desconhecidas e null são rejeitados. Identificadores ASCII não são normalizados; nomes e labels recebem trim. Limite total: 100 KiB.",
	});
}

export function ApiContentResponse(
	schema: string,
	status = 200,
	array = false,
) {
	const ref = { $ref: `#/components/schemas/${schema}` };
	return ApiResponse({
		status,
		schema: array ? { type: "array", items: ref } : ref,
	});
}

export function ApiContentErrors() {
	return applyDecorators(
		...[
			[
				400,
				"Payload ou UUID inválido; propriedades desconhecidas, tipos, limites e keys duplicadas são rejeitados.",
			],
			[401, "Autenticação ausente, inválida ou expirada."],
			[
				404,
				"Recurso inexistente ou pertencente a outro usuário: resposta idêntica.",
			],
			[
				409,
				"Identifier já existe no escopo, limite de 100 coleções/templates atingido, ou alteração de fields invalidaria registros existentes.",
			],
			[413, "Corpo excede o limite de 100 KiB."],
			[500, "Falha inesperada."],
		].map(([status, description]) =>
			ApiResponse({
				status: status as number,
				description: description as string,
				type: ApiErrorResponseDto,
			}),
		),
	);
}
