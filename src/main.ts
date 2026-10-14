import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { env } from "./modules/shared/config/env";
import {
	accessCookieName,
	refreshCookieName,
} from "./modules/shared/infrastructure/auth/auth-cookies";
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
			.addCookieAuth(
				accessCookieName(),
				{ type: "apiKey", in: "cookie" },
				"cookieAuth",
			)
			.addCookieAuth(
				refreshCookieName(),
				{ type: "apiKey", in: "cookie" },
				"refreshCookieAuth",
			)
			.build();

		const documentFactory = () => createOpenApiDocument(app, config);
		SwaggerModule.setup("docs", app, documentFactory);
	}

	await app.listen(env.PORT ?? env.SERVER_PORT);
}
void bootstrap().catch((error: unknown) => {
	const errorMessage =
		error instanceof Error
			? error.message
				.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[REDACTED]@")
				.replace(/\b(password|passwd|token|secret)=([^\s&]+)/gi, "$1=[REDACTED]")
			: "Unknown startup error";
	new Logger("Bootstrap").error({
		event: "startup_failed",
		errorType: error instanceof Error ? error.name : typeof error,
		message: errorMessage,
	});
	process.exit(1);
});
