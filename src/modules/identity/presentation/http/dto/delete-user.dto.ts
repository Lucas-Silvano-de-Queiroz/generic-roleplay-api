import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";

export const deleteUserSchema = z.object({
	password: z.string().min(8, "Password must be at least 8 characters"),
});

export type DeleteUserRequest = z.infer<typeof deleteUserSchema>;

export abstract class DeleteUserRequestDto {
	@ApiProperty({
		description: "Senha atual da conta (mínimo de 8 caracteres).",
		example: "senha-segura-123",
		minLength: 8,
		writeOnly: true,
	})
	abstract password: string;
}
