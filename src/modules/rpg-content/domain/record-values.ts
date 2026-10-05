import type { FieldDefinition } from "./content.schemas";
import type { RecordValidationIssue, RecordValues } from "./records";
import { RECORD_VALUE_MAX_LENGTH } from "./records.schemas";

/** Presentation formats never transform persisted text. Only own values satisfy fields. */
export function validateRecordValues(
	values: RecordValues,
	fields: readonly FieldDefinition[],
): RecordValidationIssue[] {
	const definitions = new Map(fields.map((field) => [field.key, field]));
	const issues: RecordValidationIssue[] = [];
	for (const [key, value] of Object.entries(values)) {
		const field = definitions.get(key);
		if (!field) {
			issues.push({
				field: `values.${key}`,
				message: "Unknown template field",
			});
			continue;
		}
		const maxLength = Math.min(
			field.maxLength ?? RECORD_VALUE_MAX_LENGTH,
			RECORD_VALUE_MAX_LENGTH,
		);
		if (value.length > maxLength)
			issues.push({
				field: `values.${key}`,
				message: `Must contain at most ${maxLength} UTF-16 units`,
			});
	}
	for (const field of fields) {
		if (
			field.required &&
			(!Object.hasOwn(values, field.key) ||
				values[field.key].trim().length === 0)
		)
			issues.push({
				field: `values.${field.key}`,
				message: "Required field must contain non-whitespace text",
			});
	}
	return issues;
}
