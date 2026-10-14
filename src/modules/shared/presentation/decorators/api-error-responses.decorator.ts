import { applyDecorators } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";
import { ApiErrorResponseDto } from "../dto/api-error-response.dto";

interface ApiErrorExample {
	statusCode: number;
	message: string;
	details?: { field: string; message: string }[];
}

interface ApiErrorResponseOptions {
	statusCode: number;
	description: string;
	example: ApiErrorExample;
	headers?: {
		"Retry-After": {
			description: string;
			schema: { type: "integer" };
		};
	};
}

const validationExample = (
	field: string,
	message: string,
): ApiErrorExample => ({
	statusCode: 400,
	message: "Validation failed",
	details: [{ field, message }],
});

function apiErrorResponses(...responses: ApiErrorResponseOptions[]) {
	return applyDecorators(
		...responses.map(({ statusCode, ...response }) =>
			ApiResponse({
				status: statusCode,
				type: ApiErrorResponseDto,
				...response,
			}),
		),
	);
}

export const ApiLoginErrorResponses = () =>
	apiErrorResponses(
		{
			statusCode: 400,
			description: "Dados inválidos.",
			example: validationExample("email", "Invalid email address"),
		},
		{
			statusCode: 401,
			description: "E-mail ou senha incorretos.",
			example: { statusCode: 401, message: "Invalid credentials" },
		},
		{
			statusCode: 429,
			description: "Limite de chamadas excedido. Consulte Retry-After.",
			headers: {
				"Retry-After": {
					description: "Segundos até que uma nova tentativa seja permitida.",
					schema: { type: "integer" },
				},
			},
			example: {
				statusCode: 429,
				message: "Too many requests. Try again later.",
			},
		},
		{
			statusCode: 500,
			description: "Falha inesperada.",
			example: { statusCode: 500, message: "Internal Server Error" },
		},
	);

export const ApiRefreshErrorResponses = (isLogout = false) =>
	apiErrorResponses(
		{
			statusCode: 401,
			description: isLogout
				? "Cookie de refresh inválido, expirado ou de tipo incorreto. Cookie ausente encerra o acesso local com 204."
				: "Cookie de refresh ausente, inválido, expirado, consumido, revogado ou associado a conta inexistente.",
			example: { statusCode: 401, message: "Invalid credentials" },
		},
		{
			statusCode: 429,
			description: "Limite de chamadas excedido.",
			headers: {
				"Retry-After": {
					description: "Segundos até uma nova tentativa.",
					schema: { type: "integer" },
				},
			},
			example: {
				statusCode: 429,
				message: "Too many requests. Try again later.",
			},
		},
		{
			statusCode: 503,
			description: "Capacidade de autenticação ou banco indisponível.",
			example: {
				statusCode: 503,
				message: "Authentication service unavailable",
			},
		},
		{
			statusCode: 500,
			description: "Falha inesperada.",
			example: { statusCode: 500, message: "Internal Server Error" },
		},
	);

export const ApiCreateUserErrorResponses = () =>
	apiErrorResponses(
		{
			statusCode: 400,
			description: "Dados inválidos.",
			example: validationExample("email", "Invalid email address"),
		},
		{
			statusCode: 409,
			description: "Já existe uma conta com esse e-mail.",
			example: { statusCode: 409, message: "User already exists" },
		},
		{
			statusCode: 429,
			description: "Limite de chamadas excedido.",
			headers: {
				"Retry-After": {
					description: "Segundos até uma nova tentativa.",
					schema: { type: "integer" },
				},
			},
			example: {
				statusCode: 429,
				message: "Too many requests. Try again later.",
			},
		},
		{
			statusCode: 503,
			description: "Capacidade de autenticação ou banco indisponível.",
			example: {
				statusCode: 503,
				message: "Authentication service unavailable",
			},
		},
		{
			statusCode: 500,
			description: "Falha inesperada.",
			example: { statusCode: 500, message: "Internal Server Error" },
		},
	);

export const ApiDeleteUserErrorResponses = () =>
	apiErrorResponses(
		{
			statusCode: 400,
			description: "Senha ausente ou inválida.",
			example: validationExample(
				"password",
				"Password must be at least 8 characters",
			),
		},
		{
			statusCode: 401,
			description: "Token ausente, inválido ou senha incorreta.",
			example: { statusCode: 401, message: "Unauthorized" },
		},
		{
			statusCode: 404,
			description: "Usuário do token não foi encontrado.",
			example: { statusCode: 404, message: "User not found" },
		},
		{
			statusCode: 429,
			description: "Limite de chamadas excedido.",
			headers: {
				"Retry-After": {
					description: "Segundos até uma nova tentativa.",
					schema: { type: "integer" },
				},
			},
			example: {
				statusCode: 429,
				message: "Too many requests. Try again later.",
			},
		},
		{
			statusCode: 503,
			description: "Capacidade de autenticação ou banco indisponível.",
			example: {
				statusCode: 503,
				message: "Authentication service unavailable",
			},
		},
		{
			statusCode: 500,
			description: "Falha inesperada.",
			example: { statusCode: 500, message: "Internal Server Error" },
		},
	);
