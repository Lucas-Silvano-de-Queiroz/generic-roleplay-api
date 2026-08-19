import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { env } from "@shared/config/env";
import { IdentityModule } from "../identity/identity.module";
import { TOKEN_SERVICE_CONTRACT } from "./application/contracts/token-service.contract";
import { LoginUseCase } from "./application/usecases/login.use-case";
import { JwtAuthGuard } from "./infrastructure/auth/jwt-auth.guard";
import { JwtTokenService } from "./infrastructure/auth/jwt-token.service";
import { JwtStrategy } from "./infrastructure/passport/jwt.strategy";
import { AuthenticationController } from "./presentation/http/controllers/authentication.controller";

@Module({
	imports: [
		IdentityModule,

		JwtModule.register({
			privateKey: Buffer.from(env.JWT_PRIVATE_KEY_BASE64, "base64"),

			publicKey: Buffer.from(env.JWT_PUBLIC_KEY_BASE64, "base64"),

			signOptions: {
				algorithm: "RS256",
				expiresIn: env.JWT_EXPIRES_IN,
			},
		}),
	],

	controllers: [AuthenticationController],

	providers: [
		LoginUseCase,
		JwtTokenService,
		JwtStrategy,

		{
			provide: TOKEN_SERVICE_CONTRACT,
			useExisting: JwtTokenService,
		},

		{
			provide: APP_GUARD,
			useClass: JwtAuthGuard,
		},
	],
})
export class AuthenticationModule {}
