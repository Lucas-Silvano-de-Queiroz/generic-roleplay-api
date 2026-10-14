export type RecordValues = Record<string, string>;
export interface RpgRecord {
	id: string;
	templateId: string;
	values: RecordValues;
	createdAt: Date;
	updatedAt: Date;
}
export interface RecordPage {
	items: RpgRecord[];
	nextCursor?: string;
}
export interface RecordValidationIssue {
	field: string;
	message: string;
}
