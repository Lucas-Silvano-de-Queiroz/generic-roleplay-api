import { z } from "zod";

const envSchema = z.object({
	// Application
	SERVER_PORT: z.coerce.number().default(3000),
	// Database
	DATABASE_URL: z.string(),
	// Security
	PEPPER: z.string(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
	console.error("Variáveis de ambiente inválidas:");
	console.error(z.treeifyError(result.error));

	process.exit(1);
}

export const env = result.data;
