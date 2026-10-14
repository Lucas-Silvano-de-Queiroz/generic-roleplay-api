import { z } from "zod";

export const databaseUrlSchema = z
	.url()
	.refine(
		(value) =>
			value.startsWith("postgres://") || value.startsWith("postgresql://"),
		"DATABASE_URL must be PostgreSQL",
	);
