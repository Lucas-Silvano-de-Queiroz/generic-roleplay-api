import { and, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "modules/shared/infrastructure/database/drizzle";
import {
	rpgCollections,
	rpgSystems,
	rpgTemplates,
} from "./schema/rpg-content.schema";
import { rpgRecords } from "./schema/rpg-records.schema";
export const ownedSystems = (owner: string) =>
	db
		.select({ id: rpgSystems.id })
		.from(rpgSystems)
		.where(eq(rpgSystems.userId, owner));
export const ownedCollections = (owner: string) =>
	db
		.select({ id: rpgCollections.id })
		.from(rpgCollections)
		.where(inArray(rpgCollections.systemId, ownedSystems(owner)));
export const ownedTemplates = (owner: string) =>
	db
		.select({ id: rpgTemplates.id })
		.from(rpgTemplates)
		.where(inArray(rpgTemplates.collectionId, ownedCollections(owner)));
export const systemScope = (owner: string, id: string): SQL =>
	and(eq(rpgSystems.id, id), eq(rpgSystems.userId, owner)) as SQL;
export const collectionScope = (owner: string, id: string): SQL =>
	and(
		eq(rpgCollections.id, id),
		inArray(rpgCollections.systemId, ownedSystems(owner)),
	) as SQL;
export const templateScope = (owner: string, id: string): SQL =>
	and(
		eq(rpgTemplates.id, id),
		inArray(rpgTemplates.collectionId, ownedCollections(owner)),
	) as SQL;
export const recordScope = (owner: string, id: string): SQL =>
	and(
		eq(rpgRecords.id, id),
		inArray(rpgRecords.templateId, ownedTemplates(owner)),
	) as SQL;
