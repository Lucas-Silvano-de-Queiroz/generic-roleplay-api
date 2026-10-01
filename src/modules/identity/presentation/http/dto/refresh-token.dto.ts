import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";

export const refreshTokenSchema = z.object({
	refreshToken: z.string().min(1, "Refresh token is required").max(4096),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;

export abstract class RefreshTokenRequestDto {
	@ApiProperty({
		description: "Refresh token JWT recebido no login ou renovação.",
		minLength: 1,
		maxLength: 4096,
	})
	abstract refreshToken: string;
}

export class RefreshTokenResponseDto {
	@ApiProperty({ description: "Novo refresh token; substitui o anterior." })
	refreshToken!: string;
	@ApiProperty({ description: "Novo access token JWT, válido por 15 minutos." })
	accessToken!: string;

	@ApiProperty({ example: "Bearer" })
	tokenType!: "Bearer";
}
