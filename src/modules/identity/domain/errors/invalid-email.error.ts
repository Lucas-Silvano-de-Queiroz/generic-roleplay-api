import { BadRequestException } from "@nestjs/common";

export class InvalidEmailError extends BadRequestException {
	constructor() {
		super("Invalid email format");
	}
}
