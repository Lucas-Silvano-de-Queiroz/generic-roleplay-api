import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { env } from "modules/shared/config/env";
import { HASH_SERVICE_CONTRACT } from "./application/contracts/hash-service.contract.token";
import { IDENTITY_CREDENTIALS_READER } from "./application/contracts/identity-credentials-reader.token";
import { TOKEN_SERVICE_CONTRACT } from "./application/contracts/token-service.contract";
import { IdentityCredentialsReaderService } from "./application/services/identity-credentials-reader.service";
import { CreateUserUseCase } from "./application/usecases/create-user.use-case";
import { DeleteUserUseCase } from "./application/usecases/delete-user.use-case";
import { LoginUseCase } from "./application/usecases/login.use-case";
import { USER_REPOSITORY } from "./domain/repositories/user.repository.token";
import { JwtAuthGuard } from "./infrastructure/auth/jwt-auth.guard";
import { JwtTokenService } from "./infrastructure/auth/jwt-token.service";
import { Argon2HashServiceAdapter } from "./infrastructure/crypto/argon2-hash.adapter";
import { DrizzleUserRepositoryPostgreSQL } from "./infrastructure/database/repositories/drizzle-user.repository-postgresql";
import { JwtStrategy } from "./infrastructure/passport/jwt.strategy";
import { AuthenticationController } from "./presentation/http/controllers/authentication.controller";
import { UserController } from "./presentation/http/controllers/user.controller";

@Module({
	imports: [
		JwtModule.register({
			privateKey: Buffer.from(env.JWT_PRIVATE_KEY_BASE64, "base64"),
			publicKey: Buffer.from(env.JWT_PUBLIC_KEY_BASE64, "base64"),
			signOptions: {
				algorithm: "RS256",
				expiresIn: env.JWT_EXPIRES_IN,
			},
		}),
	],
	controllers: [AuthenticationController, UserController],
	providers: [
		CreateUserUseCase,
		DeleteUserUseCase,
		LoginUseCase,
		JwtTokenService,
		JwtStrategy,
		{
			provide: USER_REPOSITORY,
			useClass: DrizzleUserRepositoryPostgreSQL,
		},
		{
			provide: HASH_SERVICE_CONTRACT,
			useClass: Argon2HashServiceAdapter,
		},
		{
			provide: IDENTITY_CREDENTIALS_READER,
			useClass: IdentityCredentialsReaderService,
		},
		{
			provide: TOKEN_SERVICE_CONTRACT,
			useExisting: JwtTokenService,
		},
		{
			provide: APP_GUARD,
			useClass: JwtAuthGuard,
		},
	],
	exports: [
		IDENTITY_CREDENTIALS_READER,
		HASH_SERVICE_CONTRACT,
		CreateUserUseCase,
		DeleteUserUseCase,
		LoginUseCase,
	],
})
export class IdentityModule {}
