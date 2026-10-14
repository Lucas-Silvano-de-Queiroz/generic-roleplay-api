import { BadRequestException, ConflictException } from "@nestjs/common";
import type { RecordValidationIssue } from "../domain/records";
export class InvalidRecordValuesError extends BadRequestException {
	constructor(details: RecordValidationIssue[]) {
		super({ message: "Validation failed", details });
	}
}
export class RecordLimitError extends ConflictException {
	constructor() {
		super("Record limit reached");
	}
}
export class TemplateRecordsConflictError extends ConflictException {
	constructor() {
		super("Template change would invalidate existing records");
	}
}
