import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { env } from "modules/shared/config/env";
import { HASH_SERVICE_CONTRACT } from "./application/contracts/hash-service.contract.token";
import { TOKEN_SERVICE_CONTRACT } from "./application/contracts/token-service.contract";
import { CreateUserUseCase } from "./application/usecases/create-user.use-case";
import { DeleteUserUseCase } from "./application/usecases/delete-user.use-case";
import { LoginUseCase } from "./application/usecases/login.use-case";
import { RefreshAccessTokenUseCase } from "./application/usecases/refresh-access-token.use-case";
import { SESSION_REPOSITORY } from "./domain/repositories/session.repository";
import { USER_REPOSITORY } from "./domain/repositories/user.repository.token";
import { JwtAuthGuard } from "./infrastructure/auth/jwt-auth.guard";
import { JwtTokenService } from "./infrastructure/auth/jwt-token.service";
import { Argon2HashServiceAdapter } from "./infrastructure/crypto/argon2-hash.adapter";
import { DrizzleSessionRepository } from "./infrastructure/database/repositories/drizzle-session.repository";
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
				issuer: env.JWT_ISSUER,
				audience: env.JWT_AUDIENCE,
			},
		}),
	],
	controllers: [AuthenticationController, UserController],
	providers: [
		CreateUserUseCase,
		DeleteUserUseCase,
		LoginUseCase,
		RefreshAccessTokenUseCase,
		JwtTokenService,
		JwtStrategy,
		{ provide: SESSION_REPOSITORY, useClass: DrizzleSessionRepository },
		{
			provide: USER_REPOSITORY,
			useClass: DrizzleUserRepositoryPostgreSQL,
		},
		{
			provide: HASH_SERVICE_CONTRACT,
			useClass: Argon2HashServiceAdapter,
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
		HASH_SERVICE_CONTRACT,
		CreateUserUseCase,
		DeleteUserUseCase,
		LoginUseCase,
		RefreshAccessTokenUseCase,
	],
})
export class IdentityModule {}
