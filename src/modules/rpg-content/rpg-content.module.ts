import { Module } from "@nestjs/common";
import { CollectionsService } from "./application/collections.service";
import { RecordsService } from "./application/records.service";
import { SystemsService } from "./application/systems.service";
import { TemplatesService } from "./application/templates.service";
import { ContentRepository } from "./domain/content.repository";
import { RecordsRepository } from "./domain/records.repository";
import { DrizzleContentRepository } from "./infrastructure/database/drizzle-content.repository";
import { DrizzleRecordsRepository } from "./infrastructure/database/drizzle-records.repository";
import { CollectionsController } from "./presentation/http/collections.controller";
import { RecordsController } from "./presentation/http/records.controller";
import { SystemsController } from "./presentation/http/systems.controller";
import { TemplatesController } from "./presentation/http/templates.controller";

@Module({
	controllers: [
		SystemsController,
		CollectionsController,
		TemplatesController,
		RecordsController,
	],
	providers: [
		RecordsService,
		{ provide: RecordsRepository, useClass: DrizzleRecordsRepository },
		SystemsService,
		CollectionsService,
		TemplatesService,
		{ provide: ContentRepository, useClass: DrizzleContentRepository },
	],
})
export class RpgContentModule {}
