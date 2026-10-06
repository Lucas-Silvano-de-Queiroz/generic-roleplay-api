import type { INestApplication } from "@nestjs/common";
import { env } from "../config/env";
import { SecurityHeadersMiddleware } from "./middleware/security-headers.middleware";

/** Register before app.init/listen so parser failures receive the same protections. */
export function configureHttpApplication(app: INestApplication): void {
	app.use(new SecurityHeadersMiddleware().use);
	const allowedOrigins = env.AUTH_ALLOWED_ORIGINS.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	if (allowedOrigins.length)
		app.enableCors({ origin: allowedOrigins, credentials: true });
	app
		.getHttpAdapter()
		.getInstance()
		.set(
			"trust proxy",
			env.TRUSTED_PROXY_CIDRS
				? env.TRUSTED_PROXY_CIDRS.split(",").map((value) => value.trim())
				: false,
		);
}
