import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { IdentityModule } from "modules/identity/identity.module";
import { DatabaseShutdownProvider } from "modules/shared/infrastructure/database/database-shutdown.provider";
import { GlobalExceptionFilter } from "modules/shared/presentation/filters/global-exception.filter";

@Module({
	imports: [IdentityModule],
	controllers: [],
	providers: [
		{
			provide: APP_FILTER,
			useClass: GlobalExceptionFilter,
		},
		DatabaseShutdownProvider,
	],
})
export class AppModule {}
