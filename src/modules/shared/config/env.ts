import { z } from "zod";

const envSchema = z.object({
	SERVER_PORT: z.coerce.number().default(3000),
	NODE_ENV: z.enum(["development", "production"]).default("development"),
	DATABASE_URL: z.string(),
	PEPPER: z.string(),

	JWT_PRIVATE_KEY_BASE64: z.string(),
	JWT_PUBLIC_KEY_BASE64: z.string(),
	JWT_EXPIRES_IN: z.enum(["15m"]).default("15m"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
	console.error("Variáveis de ambiente inválidas:");
	console.error(z.treeifyError(result.error));

	process.exit(1);
}

const config = result.data;

export const env = {
	...config,

	isDevelopment: config.NODE_ENV === "development",
	isProduction: config.NODE_ENV === "production",
} as const;
