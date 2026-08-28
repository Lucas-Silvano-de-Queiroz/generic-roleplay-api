import { defineConfig } from "drizzle-kit";
import { env } from "modules/shared/config/env";

export default defineConfig({
	out: "./drizzle",
	schema: ["./src/**/infrastructure/database/**/*schema.ts"],
	dialect: "postgresql",
	dbCredentials: {
		url: env.DATABASE_URL,
	},
});
