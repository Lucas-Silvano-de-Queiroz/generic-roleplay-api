import { z } from "zod";

const envSchema = z.object({
	PORT: z.coerce.number().default(3000),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
	console.error("Variáveis inválidas:");
	console.error(z.treeifyError(result.error));
	process.exit(1);
}

export const { PORT } = result.data;
