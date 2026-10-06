import { z } from "zod";

export const IDENTIFIER_PATTERN = "^[a-z][a-z0-9_-]*$";
export const CONTENT_LIMIT = 100;
export const identifierSchema = z
	.string()
	.min(1)
	.max(64)
	.regex(new RegExp(IDENTIFIER_PATTERN));
const nameSchema = z.string().max(100).trim().min(1);
const descriptionSchema = z.string().max(5000).optional();

export const fieldDefinitionSchema = z.strictObject({
	key: identifierSchema,
	label: nameSchema,
	description: z.string().max(1000).optional(),
	required: z.boolean().default(false),
	maxLength: z.number().int().min(1).max(100000).optional(),
	format: z.enum(["text", "textarea"]).default("text"),
});

export const fieldsSchema = z
	.array(fieldDefinitionSchema)
	.max(CONTENT_LIMIT)
	.superRefine((fields, ctx) => {
		const keys = new Set<string>();
		for (const [index, field] of fields.entries()) {
			if (keys.has(field.key)) {
				ctx.addIssue({
					code: "custom",
					path: [index, "key"],
					message: `Duplicate field key: ${field.key}`,
				});
			}
			keys.add(field.key);
		}
	});

export const createSystemSchema = z.strictObject({
	name: nameSchema,
	description: descriptionSchema,
});
export const updateSystemSchema = createSystemSchema.partial();
export const createCollectionSchema = createSystemSchema.extend({
	identifier: identifierSchema,
});
export const updateCollectionSchema = createCollectionSchema.partial();
export const createTemplateSchema = createCollectionSchema.extend({
	category: z.string().max(64).optional(),
	fields: fieldsSchema.default([]),
});
// A PATCH must not apply the create-time fields default to omitted fields.
export const updateTemplateSchema = createTemplateSchema
	.partial()
	.extend({ fields: fieldsSchema.optional() });

export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;
export type CreateSystem = z.infer<typeof createSystemSchema>;
export type UpdateSystem = z.infer<typeof updateSystemSchema>;
export type CreateCollection = z.infer<typeof createCollectionSchema>;
export type UpdateCollection = z.infer<typeof updateCollectionSchema>;
export type CreateTemplate = z.infer<typeof createTemplateSchema>;
export type UpdateTemplate = z.infer<typeof updateTemplateSchema>;
