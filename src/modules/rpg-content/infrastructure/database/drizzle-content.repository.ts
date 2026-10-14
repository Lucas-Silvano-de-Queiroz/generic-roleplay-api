import { isDeepStrictEqual } from "node:util";
import { Injectable } from "@nestjs/common";
import { and, count, eq, gt, inArray } from "drizzle-orm";
import { db } from "modules/shared/infrastructure/database/drizzle";
import { uuidv7 } from "uuidv7";
import {
	ContentIdentifierConflictError,
	ContentLimitError,
} from "../../application/content.errors";
import { TemplateRecordsConflictError } from "../../application/records.errors";
import type {
	RpgCollection,
	RpgSystem,
	RpgTemplate,
} from "../../domain/content";
import { ContentRepository } from "../../domain/content.repository";
import {
	CONTENT_LIMIT,
	type CreateCollection,
	type CreateSystem,
	type CreateTemplate,
	type UpdateCollection,
	type UpdateSystem,
	type UpdateTemplate,
} from "../../domain/content.schemas";
import { validateRecordValues } from "../../domain/record-values";
import {
	collectionScope,
	ownedCollections,
	ownedSystems,
	systemScope,
	templateScope,
} from "./content-ownership";
import {
	rpgCollections,
	rpgSystems,
	rpgTemplates,
} from "./schema/rpg-content.schema";
import { rpgRecords } from "./schema/rpg-records.schema";

function systemView(row: typeof rpgSystems.$inferSelect): RpgSystem {
	return {
		id: row.id,
		name: row.name,
		...(row.description === null ? {} : { description: row.description }),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
function collectionView(
	row: typeof rpgCollections.$inferSelect,
): RpgCollection {
	return {
		id: row.id,
		systemId: row.systemId,
		name: row.name,
		identifier: row.identifier,
		...(row.description === null ? {} : { description: row.description }),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
function templateView(row: typeof rpgTemplates.$inferSelect): RpgTemplate {
	return {
		id: row.id,
		collectionId: row.collectionId,
		name: row.name,
		identifier: row.identifier,
		...(row.description === null ? {} : { description: row.description }),
		...(row.category === null ? {} : { category: row.category }),
		fields: row.fields,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function changed(current: object, patch: object): boolean {
	return Object.entries(patch).some(
		([key, value]) =>
			value !== undefined &&
			!isDeepStrictEqual(current[key as keyof typeof current], value),
	);
}

/** Drizzle wraps driver errors; only translate the named feature constraints. */
function identifierConflict(
	error: unknown,
	resource: "Collection" | "Template",
): never {
	let cause = error;
	while (cause instanceof Error) {
		if (
			"code" in cause &&
			cause.code === "23505" &&
			"constraint" in cause &&
			cause.constraint ===
				(resource === "Collection"
					? "rpg_collections_system_identifier_unique"
					: "rpg_templates_collection_identifier_unique")
		) {
			throw new ContentIdentifierConflictError(resource);
		}
		cause = cause.cause;
	}
	throw error;
}

@Injectable()
export class DrizzleContentRepository implements ContentRepository {
	async createSystem(owner: string, input: CreateSystem): Promise<RpgSystem> {
		const [row] = await db
			.insert(rpgSystems)
			.values({ ...input, id: uuidv7(), userId: owner })
			.returning();
		return systemView(row);
	}
	async listSystems(owner: string): Promise<RpgSystem[]> {
		return (
			await db
				.select()
				.from(rpgSystems)
				.where(eq(rpgSystems.userId, owner))
				.orderBy(rpgSystems.id)
		).map(systemView);
	}
	async findSystem(owner: string, id: string): Promise<RpgSystem | null> {
		const [row] = await db
			.select()
			.from(rpgSystems)
			.where(systemScope(owner, id));
		return row ? systemView(row) : null;
	}
	async updateSystem(
		owner: string,
		id: string,
		input: UpdateSystem,
	): Promise<RpgSystem | null> {
		const current = await this.findSystem(owner, id);
		if (!current || !changed(current, input)) return current;
		const [row] = await db
			.update(rpgSystems)
			.set({ ...input, updatedAt: new Date() })
			.where(systemScope(owner, id))
			.returning();
		return row ? systemView(row) : null;
	}
	async deleteSystem(owner: string, id: string): Promise<boolean> {
		return (
			(
				await db
					.delete(rpgSystems)
					.where(systemScope(owner, id))
					.returning({ id: rpgSystems.id })
			).length > 0
		);
	}

	async createCollection(
		owner: string,
		systemId: string,
		input: CreateCollection,
	): Promise<RpgCollection | null> {
		try {
			return await db.transaction(async (tx) => {
				const [parent] = await tx
					.select({ id: rpgSystems.id })
					.from(rpgSystems)
					.where(systemScope(owner, systemId))
					.for("update");
				if (!parent) return null;
				const [total] = await tx
					.select({ count: count() })
					.from(rpgCollections)
					.where(eq(rpgCollections.systemId, systemId));
				if (total.count >= CONTENT_LIMIT)
					throw new ContentLimitError("Collection");
				const [row] = await tx
					.insert(rpgCollections)
					.values({ ...input, id: uuidv7(), systemId })
					.returning();
				return collectionView(row);
			});
		} catch (error) {
			return identifierConflict(error, "Collection");
		}
	}
	async listCollections(
		owner: string,
		systemId: string,
	): Promise<RpgCollection[] | null> {
		if (!(await this.findSystem(owner, systemId))) return null;
		return (
			await db
				.select()
				.from(rpgCollections)
				.where(
					and(
						eq(rpgCollections.systemId, systemId),
						inArray(rpgCollections.systemId, ownedSystems(owner)),
					),
				)
				.orderBy(rpgCollections.id)
		).map(collectionView);
	}
	async findCollection(
		owner: string,
		id: string,
	): Promise<RpgCollection | null> {
		const [row] = await db
			.select()
			.from(rpgCollections)
			.where(collectionScope(owner, id));
		return row ? collectionView(row) : null;
	}
	async updateCollection(
		owner: string,
		id: string,
		input: UpdateCollection,
	): Promise<RpgCollection | null> {
		const current = await this.findCollection(owner, id);
		if (!current || !changed(current, input)) return current;
		try {
			const [row] = await db
				.update(rpgCollections)
				.set({ ...input, updatedAt: new Date() })
				.where(collectionScope(owner, id))
				.returning();
			return row ? collectionView(row) : null;
		} catch (error) {
			return identifierConflict(error, "Collection");
		}
	}
	async deleteCollection(owner: string, id: string): Promise<boolean> {
		return (
			(
				await db
					.delete(rpgCollections)
					.where(collectionScope(owner, id))
					.returning({ id: rpgCollections.id })
			).length > 0
		);
	}

	async createTemplate(
		owner: string,
		collectionId: string,
		input: CreateTemplate,
	): Promise<RpgTemplate | null> {
		try {
			return await db.transaction(async (tx) => {
				const [parent] = await tx
					.select({ id: rpgCollections.id })
					.from(rpgCollections)
					.where(collectionScope(owner, collectionId))
					.for("update");
				if (!parent) return null;
				const [total] = await tx
					.select({ count: count() })
					.from(rpgTemplates)
					.where(eq(rpgTemplates.collectionId, collectionId));
				if (total.count >= CONTENT_LIMIT)
					throw new ContentLimitError("Template");
				const [row] = await tx
					.insert(rpgTemplates)
					.values({ ...input, id: uuidv7(), collectionId })
					.returning();
				return templateView(row);
			});
		} catch (error) {
			return identifierConflict(error, "Template");
		}
	}
	async listTemplates(
		owner: string,
		collectionId: string,
	): Promise<RpgTemplate[] | null> {
		if (!(await this.findCollection(owner, collectionId))) return null;
		return (
			await db
				.select()
				.from(rpgTemplates)
				.where(
					and(
						eq(rpgTemplates.collectionId, collectionId),
						inArray(rpgTemplates.collectionId, ownedCollections(owner)),
					),
				)
				.orderBy(rpgTemplates.id)
		).map(templateView);
	}
	async findTemplate(owner: string, id: string): Promise<RpgTemplate | null> {
		const [row] = await db
			.select()
			.from(rpgTemplates)
			.where(templateScope(owner, id));
		return row ? templateView(row) : null;
	}
	async updateTemplate(
		owner: string,
		id: string,
		input: UpdateTemplate,
	): Promise<RpgTemplate | null> {
		try {
			return await db.transaction(async (tx) => {
				const [current] = await tx
					.select()
					.from(rpgTemplates)
					.where(templateScope(owner, id))
					.for("update");
				if (!current) return null;
				if (!changed(current, input)) return templateView(current);
				if (
					input.fields !== undefined &&
					!isDeepStrictEqual(current.fields, input.fields)
				) {
					let cursor: string | undefined;
					while (true) {
						const batch = await tx
							.select({ id: rpgRecords.id, values: rpgRecords.values })
							.from(rpgRecords)
							.where(
								and(
									eq(rpgRecords.templateId, id),
									cursor ? gt(rpgRecords.id, cursor) : undefined,
								),
							)
							.orderBy(rpgRecords.id)
							.limit(50);
						for (const record of batch) {
							if (validateRecordValues(record.values, input.fields).length)
								throw new TemplateRecordsConflictError();
						}
						if (batch.length < 50) break;
						cursor = batch[batch.length - 1].id;
					}
				}
				const [row] = await tx
					.update(rpgTemplates)
					.set({ ...input, updatedAt: new Date() })
					.where(templateScope(owner, id))
					.returning();
				return row ? templateView(row) : null;
			});
		} catch (error) {
			return identifierConflict(error, "Template");
		}
	}

	async deleteTemplate(owner: string, id: string): Promise<boolean> {
		return (
			(
				await db
					.delete(rpgTemplates)
					.where(templateScope(owner, id))
					.returning({ id: rpgTemplates.id })
			).length > 0
		);
	}
}
