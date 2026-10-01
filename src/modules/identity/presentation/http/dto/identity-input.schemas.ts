import { z } from "zod";

export const emailSchema = z
	.string()
	.max(512)
	.trim()
	.toLowerCase()
	.max(255)
	.pipe(z.email("Invalid email address"));
export const passwordSchema = z
	.string()
	.max(1024, "Password must be at most 1024 characters");
export const nameSchema = z
	.string()
	.max(1024)
	.trim()
	.refine((value) => Array.from(value).length >= 1, "Name is required")
	.refine(
		(value) => Array.from(value).length <= 255,
		"Name must be at most 255 characters",
	);
