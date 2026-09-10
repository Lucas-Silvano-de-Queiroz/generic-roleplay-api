import { z } from "zod";

export const createUserSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: z.email("Invalid email address"),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

export type CreateUserRequest = z.infer<typeof createUserSchema>;

export abstract class CreateUserRequestDto {
	/**
	 * User name
	 * @example "John Doe"
	 */
	abstract name: string;
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

export abstract class CreateUserResponseDto {
	/**
	 * User name
	 * @example "id"
	 */
	abstract id: string;
}
