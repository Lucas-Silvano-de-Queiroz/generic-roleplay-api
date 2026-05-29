import { env } from "@shared/config/env";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./drizzle",
	schema: ["./src/**/infrastructure/database/**/*schema.ts"],
	dialect: "postgresql",
	dbCredentials: {
		url: env.DATABASE_URL,
	},
});
