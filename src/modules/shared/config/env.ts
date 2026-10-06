import { createPrivateKey, createPublicKey } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { databaseUrlSchema } from "./database-url.schema";

const envSchema = z.object({
	SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
	NODE_ENV: z.enum(["development", "production"]),
	DATABASE_URL: databaseUrlSchema,
	PEPPER: z
		.string()
		.min(32, "PEPPER must contain at least 32 characters")
		.refine(
			(value) => !value.startsWith("replace-with-"),
			"Replace the example pepper with a random secret",
		),

	JWT_PRIVATE_KEY_BASE64: z.string().min(1),
	JWT_PUBLIC_KEY_BASE64: z.string().min(1),
	JWT_EXPIRES_IN: z.enum(["15m"]).default("15m"),
	JWT_REFRESH_EXPIRES_IN: z.enum(["15d"]).default("15d"),
	JWT_ISSUER: z.string().min(1).max(255).default("generic-roleplay-api"),
	JWT_AUDIENCE: z.string().min(1).max(255).default("generic-roleplay-client"),
	HASH_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
	HASH_QUEUE_LIMIT: z.coerce.number().int().min(0).max(128).default(16),
	DATABASE_QUERY_TIMEOUT_MS: z.coerce
		.number()
		.int()
		.min(100)
		.max(60000)
		.default(5000),
	TRUSTED_PROXY_CIDRS: z
		.string()
		.default("")
		.refine(
			(value) =>
				value === "" ||
				value.split(",").every((entry) => {
					const [ip, prefix, extra] = entry.trim().split("/");
					const family = isIP(ip);
					return (
						!extra &&
						family !== 0 &&
						(prefix === undefined ||
							(/^\d+$/.test(prefix) &&
								Number(prefix) > 0 &&
								Number(prefix) <= (family === 4 ? 32 : 128)))
					);
				}),
			"Trusted proxies must be explicit IPs/CIDRs, without /0",
		),
	AUTH_GLOBAL_LIMIT: z.coerce.number().int().min(10).max(1200).default(1200),
	AUTH_ALLOWED_ORIGINS: z
		.string()
		.max(4096)
		.default("")
		.refine(
			(value) =>
				value === "" ||
				value.split(",").every((entry) => {
					try {
						const origin = new URL(entry.trim());
						return (
							["http:", "https:"].includes(origin.protocol) &&
							origin.origin === entry.trim()
						);
					} catch {
						return false;
					}
				}),
			"Allowed origins must be explicit HTTP(S) origins without paths or wildcards",
		),
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
	if (
		privateKey.asymmetricKeyType !== "rsa" ||
		(privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048 ||
		(privateKey.asymmetricKeyDetails?.modulusLength ?? 0) > 4096
	) {
		throw new Error("JWT keys must be RSA 2048–4096 bits");
	}
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
		"JWT keys must contain a matching RSA 2048–4096 bit PEM key pair encoded as base64.",
	);
	process.exit(1);
}

export const env = {
	...config,

	isDevelopment: config.NODE_ENV === "development",
	isProduction: config.NODE_ENV === "production",
} as const;
