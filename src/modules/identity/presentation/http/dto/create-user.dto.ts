import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";
import {
	emailSchema,
	nameSchema,
	passwordSchema,
} from "./identity-input.schemas";

export const createUserSchema = z.object({
	name: nameSchema,
	email: emailSchema,
	password: passwordSchema.min(8, "Password must be at least 8 characters"),
});

export type CreateUserRequest = z.infer<typeof createUserSchema>;

export abstract class CreateUserRequestDto {
	@ApiProperty({
		description: "Nome exibido para o usuário (mínimo de 1 caractere).",
		example: "John Doe",
		minLength: 1,
		maxLength: 255,
	})
	abstract name: string;
	@ApiProperty({
		description: "E-mail da conta; espaços externos são removidos.",
		example: "ana@example.com",
		format: "email",
		maxLength: 255,
	})
	abstract email: string;
	@ApiProperty({
		description: "Senha com no mínimo 8 caracteres.",
		example: "senha-segura-123",
		minLength: 8,
		maxLength: 1024,
		writeOnly: true,
	})
	abstract password: string;
}

export abstract class CreateUserResponseDto {
	@ApiProperty({
		description: "Identificador do usuário criado.",
		example: "0194f3a2-7b8c-7def-8abc-123456789012",
	})
	abstract id: string;
}
