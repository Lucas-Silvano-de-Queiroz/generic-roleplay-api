import { Entity } from "@shared/domain/entities/entity";
import { Email } from "../value-objects/email.vo";

interface UserProps {
	name: string;
	email: Email;
	passwordHash: string;
}

export class User extends Entity<UserProps> {
	static create(props: UserProps): User {
		return new User(props);
	}
	static restore(props: UserProps & { id: string }): User {
		return new User(props, props.id);
	}
	get email(): Email {
		return this._props.email;
	}

	get name(): string {
		return this._props.name;
	}

	get passwordHash(): string {
		return this._props.passwordHash;
	}
}
