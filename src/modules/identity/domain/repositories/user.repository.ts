import { User } from "../entities/user.entity";
import { Email } from "../value-objects/email.vo";

export interface UserRepository {
	create(user: User): Promise<boolean>;
	findByEmail(email: Email): Promise<User | null>;
	findById(userId: string): Promise<User | null>;
	deleteById(userId: string): Promise<void>;
}
