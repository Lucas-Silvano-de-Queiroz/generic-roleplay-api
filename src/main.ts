import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { env } from "./modules/shared/config/env";
import { configureHttpApplication } from "./modules/shared/presentation/configure-http-application";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	configureHttpApplication(app);
	app.enableShutdownHooks();

	if (env.isDevelopment) {
		const config = new DocumentBuilder()
			.setTitle("Generic Roleplay API")
			.setDescription(
				"API de cadastro, autenticação e gerenciamento da própria conta.",
			)
			.setVersion("1.0")
			.addBearerAuth()
			.build();

		const documentFactory = () => SwaggerModule.createDocument(app, config);
		SwaggerModule.setup("docs", app, documentFactory);
	}

	await app.listen(env.SERVER_PORT);
}
void bootstrap().catch(() => {
	new Logger("Bootstrap").error({ event: "startup_failed" });
	process.exit(1);
});
