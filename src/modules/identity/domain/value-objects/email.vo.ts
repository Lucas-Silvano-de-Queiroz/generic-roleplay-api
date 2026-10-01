import { InvalidEmailError } from "../errors/invalid-email.error";

export class Email {
	private constructor(private readonly _value: string) {
		if (!this.validate(_value)) {
			throw new InvalidEmailError();
		}
	}
	static create(email: string): Email {
		return new Email(email.trim().toLowerCase());
	}

	private validate(email: string): boolean {
		if (email.length > 255 || /\s/.test(email)) return false;
		const at = email.indexOf("@");
		if (at < 1 || at !== email.lastIndexOf("@")) return false;
		const dot = email.indexOf(".", at + 2);
		return dot !== -1 && dot < email.length - 1;
	}

	get value() {
		return this._value;
	}
}
