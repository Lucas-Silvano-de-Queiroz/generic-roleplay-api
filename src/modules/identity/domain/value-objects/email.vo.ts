import { InvalidEmailError } from "../errors/invalid-email.error";

export class Email {
	private constructor(private readonly _value: string) {
		if (!this.validate(_value)) {
			throw new InvalidEmailError();
		}
	}
	static create(email: string): Email {
		return new Email(email);
	}

	private validate(email: string): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	}

	get value() {
		return this._value;
	}
}
