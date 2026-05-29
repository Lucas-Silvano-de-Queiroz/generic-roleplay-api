import { Module } from "@nestjs/common";
import { UserSystemAccountModule } from "./user-system-account/user-system-account.module";

@Module({
	imports: [UserSystemAccountModule],
	controllers: [],
	providers: [],
})
export class AppModule {}
