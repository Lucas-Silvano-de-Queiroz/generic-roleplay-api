import { DomainError } from "modules/shared/domain/errors/domain.error";

export class InvalidEmailError extends DomainError {
	readonly code = "INVALID_EMAIL";

	constructor() {
		super("Invalid email format");
	}
}
