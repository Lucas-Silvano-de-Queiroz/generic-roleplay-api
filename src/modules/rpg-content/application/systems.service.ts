import { Injectable } from "@nestjs/common";
import { ContentRepository } from "../domain/content.repository";
import type { CreateSystem, UpdateSystem } from "../domain/content.schemas";
import { ContentNotFoundError, requireContent } from "./content.errors";

@Injectable()
export class SystemsService {
	constructor(private readonly repository: ContentRepository) {}
	create(owner: string, input: CreateSystem) {
		return this.repository.createSystem(owner, input);
	}
	list(owner: string) {
		return this.repository.listSystems(owner);
	}
	async get(owner: string, id: string) {
		return requireContent(await this.repository.findSystem(owner, id));
	}
	async update(owner: string, id: string, input: UpdateSystem) {
		return requireContent(await this.repository.updateSystem(owner, id, input));
	}
	async delete(owner: string, id: string) {
		if (!(await this.repository.deleteSystem(owner, id)))
			throw new ContentNotFoundError();
	}
}
