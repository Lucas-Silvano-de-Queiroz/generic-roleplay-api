import { Module } from "@nestjs/common";
import { AuthenticationModule } from "./auth/authentication.module";
import { IdentityModule } from "./identity/identity.module";

@Module({
	imports: [IdentityModule, AuthenticationModule],
})
export class UserAccountModule {}
