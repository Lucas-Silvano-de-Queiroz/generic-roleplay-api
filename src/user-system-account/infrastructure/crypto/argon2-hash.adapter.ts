import { env } from "@shared/config/env";
import { HashServiceContract } from "@user-system-account/application/contracts/hash-service.contract";
import argon2 from "argon2";

export class Argon2HashServiceAdapter implements HashServiceContract {
	async hashPassword(password: string): Promise<string> {
		const peppered = password + env.PEPPER;
		return await argon2.hash(peppered, {
			type: argon2.argon2id,
		});
	}

	async comparePassword(password: string, hash: string): Promise<boolean> {
		const peppered = password + env.PEPPER;
		try {
			return await argon2.verify(hash, peppered);
		} catch {
			return false;
		}
	}
}
