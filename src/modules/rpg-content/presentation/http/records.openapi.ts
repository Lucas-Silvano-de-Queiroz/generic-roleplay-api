import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiResponse } from "@nestjs/swagger";
import { ApiErrorResponseDto } from "modules/shared/presentation/dto/api-error-response.dto";
import { z } from "zod";
import {
	createRecordSchema,
	recordValuesSchema,
	updateRecordSchema,
} from "../../domain/records.schemas";
import type { contentOpenApiSchemas } from "./content.openapi";

const valuesDescription =
	"Mapa textual dinâmico: keys, required e maxLength são definidos pelo template escolhido. Categorias não fixam schemas. Limite global 100.000 unidades UTF-16 por valor. Unicode, espaços e Markdown são preservados; nenhum HTML é renderizado.";
const recordResponse = z.strictObject({
	id: z.uuid(),
	templateId: z.uuid(),
	values: recordValuesSchema,
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});
const pageResponse = z.strictObject({
	items: z.array(recordResponse),
	nextCursor: z.uuid().optional(),
});
export function recordsOpenApiSchemas(): ReturnType<
	typeof contentOpenApiSchemas
> {
	const contracts = {
		RecordValues: recordValuesSchema,
		RpgRecord: recordResponse,
		RecordPage: pageResponse,
		CreateRecordRequest: createRecordSchema,
		UpdateRecordRequest: updateRecordSchema,
	};
	return Object.fromEntries(
		Object.entries(contracts).map(([name, schema]) => {
			const { $schema, ...document } = z.toJSONSchema(schema, {
				target: "openapi-3.0",
				io: name.endsWith("Request") ? "input" : "output",
			});
			void $schema;
			const result = document as ReturnType<
				typeof contentOpenApiSchemas
			>[string];
			if (name === "RecordValues") {
				result.description = valuesDescription;
				result.example = {
					name: "  Amizade  ",
					description: "**Material**: visco\n\n✨",
				};
			}
			if (result.properties?.values)
				result.properties.values = {
					$ref: "#/components/schemas/RecordValues",
				};
			if (name === "RecordPage" && result.properties?.items)
				result.properties.items = {
					type: "array",
					maxItems: 100,
					items: { $ref: "#/components/schemas/RpgRecord" },
				};
			if (name.endsWith("Request"))
				result.example = {
					values: { name: "Amizade", description: "**Material**: visco\n\n✨" },
				};
			return [name, result];
		}),
	);
}
export function ApiRecordBody(schema: string) {
	return ApiBody({
		schema: { $ref: `#/components/schemas/${schema}` },
		description: `Payload estrito; propriedades desconhecidas e null são rejeitados. Limite HTTP: 100 KiB. ${valuesDescription}`,
	});
}
export function ApiRecordErrors() {
	return applyDecorators(
		...[
			[
				400,
				"Payload, query ou UUID inválido; values deve satisfazer o template, com detalhes por caminho.",
			],
			[401, "Autenticação ausente, inválida ou expirada."],
			[404, "Recurso inexistente ou de outro usuário: resposta idêntica."],
			[
				409,
				"Limite de 1.000 registros atingido ou alteração de template incompatível com registros existentes.",
			],
			[413, "Corpo excede 100 KiB."],
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
