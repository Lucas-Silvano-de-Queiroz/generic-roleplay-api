import { Email } from "user-account/identity/domain/value-objects/email.vo";

export interface IdentityCredentials {
	readonly userId: string;
	readonly passwordHash: string;
}

export interface IdentityCredentialsReader {
	findCredentialsByEmail(email: Email): Promise<IdentityCredentials | null>;
}
