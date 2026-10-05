import {
	type MiddlewareConsumer,
	Module,
	type NestModule,
	RequestMethod,
} from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { IdentityModule } from "modules/identity/identity.module";
import { RpgContentModule } from "modules/rpg-content/rpg-content.module";
import { DatabaseShutdownProvider } from "modules/shared/infrastructure/database/database-shutdown.provider";
import { GlobalExceptionFilter } from "modules/shared/presentation/filters/global-exception.filter";
import { IdentityRateLimitGuard } from "./modules/shared/infrastructure/auth/identity-rate-limit.guard";
import { PostgreSqlRateLimitStore } from "./modules/shared/infrastructure/auth/postgresql-rate-limit.store";
import { SecurityStateCleanupProvider } from "./modules/shared/infrastructure/database/security-state-cleanup.provider";
import { HealthController } from "./modules/shared/presentation/controllers/health.controller";
import { SecurityHeadersMiddleware } from "./modules/shared/presentation/middleware/security-headers.middleware";

@Module({
	imports: [IdentityModule, RpgContentModule],
	controllers: [HealthController],
	providers: [
		PostgreSqlRateLimitStore,
		{ provide: APP_GUARD, useClass: IdentityRateLimitGuard },
		SecurityStateCleanupProvider,
		{
			provide: APP_FILTER,
			useClass: GlobalExceptionFilter,
		},
		DatabaseShutdownProvider,
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer): void {
		consumer
			.apply(SecurityHeadersMiddleware)
			.forRoutes({ path: "{*path}", method: RequestMethod.ALL });
	}
}
