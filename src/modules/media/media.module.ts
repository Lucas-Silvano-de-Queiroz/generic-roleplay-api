import { Module } from "@nestjs/common";
import { MediaService } from "./application/media.service";
import { MediaCleanupWorker } from "./application/media-cleanup.worker";
import { MediaStorageService } from "./infrastructure/s3/media-storage.service";
import { MediaController } from "./presentation/http/media.controller";

@Module({
	controllers: [MediaController],
	providers: [MediaService, MediaStorageService, MediaCleanupWorker],
})
export class MediaModule {}
