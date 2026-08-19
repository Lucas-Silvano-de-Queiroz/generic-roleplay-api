import { User } from "../entities/user.entity";
import { Email } from "../value-objects/email.vo";

export interface UserRepository {
	save(user: User): Promise<void>;
	findByEmail(email: Email): Promise<User | null>;
}
