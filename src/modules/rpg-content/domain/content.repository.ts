import type { RpgCollection, RpgSystem, RpgTemplate } from "./content";
import type {
	CreateCollection,
	CreateSystem,
	CreateTemplate,
	UpdateCollection,
	UpdateSystem,
	UpdateTemplate,
} from "./content.schemas";

/** Every operation is scoped to the authenticated owner, including direct child IDs. */
export abstract class ContentRepository {
	abstract createSystem(owner: string, input: CreateSystem): Promise<RpgSystem>;
	abstract listSystems(owner: string): Promise<RpgSystem[]>;
	abstract findSystem(owner: string, id: string): Promise<RpgSystem | null>;
	abstract updateSystem(
		owner: string,
		id: string,
		input: UpdateSystem,
	): Promise<RpgSystem | null>;
	abstract deleteSystem(owner: string, id: string): Promise<boolean>;
	abstract createCollection(
		owner: string,
		systemId: string,
		input: CreateCollection,
	): Promise<RpgCollection | null>;
	abstract listCollections(
		owner: string,
		systemId: string,
	): Promise<RpgCollection[] | null>;
	abstract findCollection(
		owner: string,
		id: string,
	): Promise<RpgCollection | null>;
	abstract updateCollection(
		owner: string,
		id: string,
		input: UpdateCollection,
	): Promise<RpgCollection | null>;
	abstract deleteCollection(owner: string, id: string): Promise<boolean>;
	abstract createTemplate(
		owner: string,
		collectionId: string,
		input: CreateTemplate,
	): Promise<RpgTemplate | null>;
	abstract listTemplates(
		owner: string,
		collectionId: string,
	): Promise<RpgTemplate[] | null>;
	abstract findTemplate(owner: string, id: string): Promise<RpgTemplate | null>;
	abstract updateTemplate(
		owner: string,
		id: string,
		input: UpdateTemplate,
	): Promise<RpgTemplate | null>;
	abstract deleteTemplate(owner: string, id: string): Promise<boolean>;
}
