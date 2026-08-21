import { z } from "zod";

export const deleteUserSchema = z.object({
	userId: z.uuidv7(),
});

export type DeleteUserRequest = z.infer<typeof deleteUserSchema>;

export abstract class DeleteUserRequestDto {
	/**
	 * User id
	 * @example "0198f5c7-1234-7abc-8def-123456789abc"
	 */
	abstract userId: string;
}
