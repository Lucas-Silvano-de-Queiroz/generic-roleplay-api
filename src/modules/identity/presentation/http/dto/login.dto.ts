import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";
import { emailSchema, passwordSchema } from "./identity-input.schemas";

export const loginSchema = z.object({
	email: emailSchema,
	password: passwordSchema.min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof loginSchema>;

export abstract class LoginDto {
	@ApiProperty({
		description: "E-mail cadastrado; espaços externos são removidos.",
		example: "ana@example.com",
		format: "email",
		maxLength: 255,
	})
	abstract email: string;
	@ApiProperty({
		description: "Senha da conta.",
		example: "senha-segura-123",
		minLength: 1,
		maxLength: 1024,
		writeOnly: true,
	})
	abstract password: string;
}

export class LoginResponseDto {
	@ApiProperty({
		description: "Token de acesso JWT, válido por 15 minutos.",
	})
	accessToken!: string;

	@ApiProperty({
		description: "Token para obter novos access tokens, válido por 15 dias.",
	})
	refreshToken!: string;

	@ApiProperty({ example: "Bearer" })
	tokenType!: "Bearer";
}
