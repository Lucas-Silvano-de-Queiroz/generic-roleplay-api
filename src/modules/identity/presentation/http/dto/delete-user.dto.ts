import { z } from "zod";

export const deleteUserSchema = z.object({
	password: z.string().min(8, "Password must be at least 8 characters"),
});

export type DeleteUserRequest = z.infer<typeof deleteUserSchema>;

export abstract class DeleteUserRequestDto {
	/**
	 * User password must be 8 chars
	 * @example password
	 */
	abstract password: string;
}
