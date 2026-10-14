import { Injectable } from "@nestjs/common";
import { RecordsRepository } from "../domain/records.repository";
import type {
	CreateRecord,
	ListRecordsQuery,
	UpdateRecord,
} from "../domain/records.schemas";
import { ContentNotFoundError, requireContent } from "./content.errors";
@Injectable()
export class RecordsService {
	constructor(private readonly repository: RecordsRepository) {}
	async create(owner: string, templateId: string, input: CreateRecord) {
		return requireContent(
			await this.repository.create(owner, templateId, input),
		);
	}
	async list(owner: string, templateId: string, query: ListRecordsQuery) {
		return requireContent(await this.repository.list(owner, templateId, query));
	}
	async get(owner: string, id: string) {
		return requireContent(await this.repository.find(owner, id));
	}
	async update(owner: string, id: string, input: UpdateRecord) {
		return requireContent(await this.repository.update(owner, id, input));
	}
	async delete(owner: string, id: string): Promise<void> {
		if (!(await this.repository.delete(owner, id)))
			throw new ContentNotFoundError();
	}
}
