import { Injectable } from "@nestjs/common";
import { ContentRepository } from "../domain/content.repository";
import type { CreateTemplate, UpdateTemplate } from "../domain/content.schemas";
import { ContentNotFoundError, requireContent } from "./content.errors";

@Injectable()
export class TemplatesService {
	constructor(private readonly repository: ContentRepository) {}
	async create(owner: string, collectionId: string, input: CreateTemplate) {
		return requireContent(
			await this.repository.createTemplate(owner, collectionId, input),
		);
	}
	async list(owner: string, collectionId: string) {
		return requireContent(
			await this.repository.listTemplates(owner, collectionId),
		);
	}
	async get(owner: string, id: string) {
		return requireContent(await this.repository.findTemplate(owner, id));
	}
	async update(owner: string, id: string, input: UpdateTemplate) {
		return requireContent(
			await this.repository.updateTemplate(owner, id, input),
		);
	}
	async delete(owner: string, id: string) {
		if (!(await this.repository.deleteTemplate(owner, id)))
			throw new ContentNotFoundError();
	}
}
