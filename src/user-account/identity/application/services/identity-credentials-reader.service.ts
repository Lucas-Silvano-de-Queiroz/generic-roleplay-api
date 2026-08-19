import { Inject, Injectable } from "@nestjs/common";
import type { UserRepository } from "user-account/identity/domain/repositories/user.repository";
import { USER_REPOSITORY } from "user-account/identity/domain/repositories/user.repository.token";
import { Email } from "user-account/identity/domain/value-objects/email.vo";
import type {
	IdentityCredentials,
	IdentityCredentialsReader,
} from "../contracts/identity-credentials.contract";

@Injectable()
export class IdentityCredentialsReaderService
	implements IdentityCredentialsReader
{
	constructor(
		@Inject(USER_REPOSITORY)
		private readonly userRepository: UserRepository,
	) {}

	async findCredentialsByEmail(
		email: Email,
	): Promise<IdentityCredentials | null> {
		const user = await this.userRepository.findByEmail(email);

		if (!user) {
			return null;
		}

		return {
			userId: user.id,
			passwordHash: user.passwordHash,
		};
	}
}
