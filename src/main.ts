import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { env } from "./modules/shared/config/env";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
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
bootstrap();
