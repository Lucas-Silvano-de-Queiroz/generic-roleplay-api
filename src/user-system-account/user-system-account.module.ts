import { Module } from "@nestjs/common";
import { HASH_SERVICE_CONTRACT } from "./application/contracts/hash-service.contract.token";
import { CreateUserUseCase } from "./application/usecases/create-user.use-case";
import { USER_REPOSITORY } from "./domain/repositories/user.repository.token";
import { Argon2HashServiceAdapter } from "./infrastructure/crypto/argon2-hash.adapter";
import { DrizzleUserRepositoryPostgreSQL } from "./infrastructure/database/repositories/drizzle-user.repository-postgresql";
import { UserController } from "./presentation/http/controllers/user.controller";

@Module({
	controllers: [UserController],
	providers: [
		CreateUserUseCase,
		{
			provide: USER_REPOSITORY,
			useClass: DrizzleUserRepositoryPostgreSQL,
		},
		{
			provide: HASH_SERVICE_CONTRACT,
			useClass: Argon2HashServiceAdapter,
		},
	],
})
export class UserSystemAccountModule {}
