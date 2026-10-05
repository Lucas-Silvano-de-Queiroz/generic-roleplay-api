import { Injectable } from "@nestjs/common";
import { ContentRepository } from "../domain/content.repository";
import type {
	CreateCollection,
	UpdateCollection,
} from "../domain/content.schemas";
import { ContentNotFoundError, requireContent } from "./content.errors";

@Injectable()
export class CollectionsService {
	constructor(private readonly repository: ContentRepository) {}
	async create(owner: string, systemId: string, input: CreateCollection) {
		return requireContent(
			await this.repository.createCollection(owner, systemId, input),
		);
	}
	async list(owner: string, systemId: string) {
		return requireContent(
			await this.repository.listCollections(owner, systemId),
		);
	}
	async get(owner: string, id: string) {
		return requireContent(await this.repository.findCollection(owner, id));
	}
	async update(owner: string, id: string, input: UpdateCollection) {
		return requireContent(
			await this.repository.updateCollection(owner, id, input),
		);
	}
	async delete(owner: string, id: string) {
		if (!(await this.repository.deleteCollection(owner, id)))
			throw new ContentNotFoundError();
	}
}
