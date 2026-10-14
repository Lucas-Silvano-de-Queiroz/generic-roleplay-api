import type { INestApplication } from "@nestjs/common";
import { type OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { contentOpenApiSchemas } from "modules/rpg-content/presentation/http/content.openapi";
import { recordsOpenApiSchemas } from "modules/rpg-content/presentation/http/records.openapi";

export function createOpenApiDocument(
	app: INestApplication,
	config: Omit<OpenAPIObject, "paths">,
): OpenAPIObject {
	const document = SwaggerModule.createDocument(app, config);
	document.components ??= {};
	document.components.schemas = {
		...document.components.schemas,
		...contentOpenApiSchemas(),
		...recordsOpenApiSchemas(),
	};
	return document;
}
