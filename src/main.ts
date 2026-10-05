import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { env } from "./modules/shared/config/env";
import { configureHttpApplication } from "./modules/shared/presentation/configure-http-application";
import { createOpenApiDocument } from "./modules/shared/presentation/create-openapi-document";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	configureHttpApplication(app);
	app.enableShutdownHooks();

	if (env.isDevelopment) {
		const config = new DocumentBuilder()
			.setTitle("Generic Roleplay API")
			.setDescription(
				"API de contas e sistemas de RPG privados com coleções, templates configuráveis e registros textuais.",
			)
			.setVersion("1.0")
			.addBearerAuth()
			.build();

		const documentFactory = () => createOpenApiDocument(app, config);
		SwaggerModule.setup("docs", app, documentFactory);
	}

	await app.listen(env.SERVER_PORT);
}
void bootstrap().catch(() => {
	new Logger("Bootstrap").error({ event: "startup_failed" });
	process.exit(1);
});
