import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ApiErrorDetailDto {
	@ApiProperty({ example: "email" })
	field!: string;

	@ApiProperty({ example: "Invalid email address" })
	message!: string;
}

export class ApiErrorResponseDto {
	@ApiProperty({ description: "Código HTTP da resposta." })
	statusCode!: number;

	@ApiProperty({ description: "Descrição do erro." })
	message!: string;

	@ApiPropertyOptional({
		description: "Detalhes dos campos inválidos, quando aplicável.",
		type: [ApiErrorDetailDto],
	})
	details?: ApiErrorDetailDto[];
}
