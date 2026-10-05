import type { RecordPage, RpgRecord } from "./records";
import type {
	CreateRecord,
	ListRecordsQuery,
	UpdateRecord,
} from "./records.schemas";
/** Owner is required for nested and direct access. */
export abstract class RecordsRepository {
	abstract create(
		owner: string,
		templateId: string,
		input: CreateRecord,
	): Promise<RpgRecord | null>;
	abstract list(
		owner: string,
		templateId: string,
		query: ListRecordsQuery,
	): Promise<RecordPage | null>;
	abstract find(owner: string, id: string): Promise<RpgRecord | null>;
	abstract update(
		owner: string,
		id: string,
		input: UpdateRecord,
	): Promise<RpgRecord | null>;
	abstract delete(owner: string, id: string): Promise<boolean>;
}
