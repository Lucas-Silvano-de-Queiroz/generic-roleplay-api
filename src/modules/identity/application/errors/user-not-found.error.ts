import { ApplicationError } from "modules/shared/application/errors/application.error";

export class UserNotFoundError extends ApplicationError {
	readonly code = "USER_NOT_FOUND";

	constructor() {
		super("User not found");
	}
}
