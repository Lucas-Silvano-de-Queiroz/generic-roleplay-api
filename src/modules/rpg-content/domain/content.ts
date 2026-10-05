import type { FieldDefinition } from "./content.schemas";

export interface RpgSystem {
	id: string;
	name: string;
	description?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface RpgCollection extends RpgSystem {
	systemId: string;
	identifier: string;
}

export interface RpgTemplate extends RpgSystem {
	collectionId: string;
	identifier: string;
	category?: string;
	fields: FieldDefinition[];
}
