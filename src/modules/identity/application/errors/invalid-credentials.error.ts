import { ApplicationError } from "modules/shared/application/errors/application.error";

export class InvalidCredentialsError extends ApplicationError {
	readonly code = "INVALID_CREDENTIALS";

	constructor() {
		super("Invalid credentials");
	}
}
