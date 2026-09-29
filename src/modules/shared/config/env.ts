import { createPrivateKey, createPublicKey } from "node:crypto";
import { z } from "zod";

const envSchema = z.object({
	SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
	NODE_ENV: z.enum(["development", "production"]).default("development"),
	DATABASE_URL: z.string(),
	PEPPER: z.string().min(32, "PEPPER must contain at least 32 characters"),

	JWT_PRIVATE_KEY_BASE64: z.string().min(1),
	JWT_PUBLIC_KEY_BASE64: z.string().min(1),
	JWT_EXPIRES_IN: z.enum(["15m"]).default("15m"),
	JWT_REFRESH_EXPIRES_IN: z.enum(["15d"]).default("15d"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
	console.error("Variáveis de ambiente inválidas:");
	console.error(z.treeifyError(result.error));

	process.exit(1);
}

const config = result.data;

try {
	const privateKey = createPrivateKey(
		Buffer.from(config.JWT_PRIVATE_KEY_BASE64, "base64"),
	);
	const configuredPublicKey = createPublicKey(
		Buffer.from(config.JWT_PUBLIC_KEY_BASE64, "base64"),
	);
	const derivedPublicKey = createPublicKey(privateKey);
	const configuredDer = configuredPublicKey.export({
		type: "spki",
		format: "der",
	});
	const derivedDer = derivedPublicKey.export({ type: "spki", format: "der" });

	if (!configuredDer.equals(derivedDer)) {
		throw new Error("JWT public and private keys do not match");
	}
} catch {
	console.error(
		"JWT_PRIVATE_KEY_BASE64 and JWT_PUBLIC_KEY_BASE64 must contain a matching PEM key pair encoded as base64.",
	);
	process.exit(1);
}

export const env = {
	...config,

	isDevelopment: config.NODE_ENV === "development",
	isProduction: config.NODE_ENV === "production",
} as const;
