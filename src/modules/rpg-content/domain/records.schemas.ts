import { z } from "zod";
import { identifierSchema } from "./content.schemas";
export const RECORD_LIMIT = 1000;
export const RECORD_VALUE_MAX_LENGTH = 100000;
export const recordValuesSchema = z.record(
	identifierSchema,
	z.string().max(RECORD_VALUE_MAX_LENGTH),
);
export const createRecordSchema = z.strictObject({
	values: recordValuesSchema,
});
export const updateRecordSchema = createRecordSchema.partial();
export const listRecordsQuerySchema = z.strictObject({
	limit: z
		.string()
		.regex(/^[0-9]+$/)
		.transform(Number)
		.pipe(z.number().int().min(1).max(100))
		.default(50),
	cursor: z.uuid().optional(),
});
export type CreateRecord = z.infer<typeof createRecordSchema>;
export type UpdateRecord = z.infer<typeof updateRecordSchema>;
export type ListRecordsQuery = z.infer<typeof listRecordsQuerySchema>;
