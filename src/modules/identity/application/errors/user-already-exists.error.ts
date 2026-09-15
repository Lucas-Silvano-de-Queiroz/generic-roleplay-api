import { ApplicationError } from "modules/shared/application/errors/application.error";

export class UserAlreadyExistsError extends ApplicationError {
	readonly code = "USER_ALREADY_EXISTS";

	constructor() {
		super("User already exists");
	}
}
