import { z } from "zod";

export const loginSchema = z.object({
	email: z.email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof loginSchema>;

export abstract class LoginDto {
	/**
	 * User email
	 * @example example@example.com
	 */
	abstract email: string;
	/**
	 * User password must 8 chars
	 * @example password
	 */
	abstract password: string;
}
