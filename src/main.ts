import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { env } from "./shared/config/env";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);

	if (env.NODE_ENV !== "production") {
		const config = new DocumentBuilder()
			.setTitle("Generic Roleplay API")
			.setVersion("1.0")
			.addTag("User")
			.build();

		const documentFactory = () => SwaggerModule.createDocument(app, config);
		SwaggerModule.setup("docs", app, documentFactory);
	}

	await app.listen(env.SERVER_PORT);
}
bootstrap();
