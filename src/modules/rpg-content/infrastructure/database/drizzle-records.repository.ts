import { isDeepStrictEqual } from "node:util";
import { Injectable } from "@nestjs/common";
import { and, count, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "modules/shared/infrastructure/database/drizzle";
import { uuidv7 } from "uuidv7";
import {
	InvalidRecordValuesError,
	RecordLimitError,
} from "../../application/records.errors";
import { validateRecordValues } from "../../domain/record-values";
import type { RecordPage, RecordValues, RpgRecord } from "../../domain/records";
import { RecordsRepository } from "../../domain/records.repository";
import {
	type CreateRecord,
	type ListRecordsQuery,
	RECORD_LIMIT,
	type UpdateRecord,
} from "../../domain/records.schemas";
import {
	ownedTemplates,
	recordScope,
	templateScope,
} from "./content-ownership";
import { rpgTemplates } from "./schema/rpg-content.schema";
import { rpgRecords } from "./schema/rpg-records.schema";

@Injectable()
export class DrizzleRecordsRepository implements RecordsRepository {
	async create(
		owner: string,
		templateId: string,
		input: CreateRecord,
	): Promise<RpgRecord | null> {
		return db.transaction(async (tx) => {
			const [template] = await tx
				.select()
				.from(rpgTemplates)
				.where(templateScope(owner, templateId))
				.for("update");
			if (!template) return null;
			const issues = validateRecordValues(input.values, template.fields);
			if (issues.length) throw new InvalidRecordValuesError(issues);
			const [total] = await tx
				.select({ count: count() })
				.from(rpgRecords)
				.where(eq(rpgRecords.templateId, templateId));
			if (total.count >= RECORD_LIMIT) throw new RecordLimitError();
			// Recheck ownership in the INSERT, as in every mutation predicate.
			const [row] = await tx
				.insert(rpgRecords)
				.select(
					tx
						.select({
							id: sql<string>`${uuidv7()}::uuid`.as("id"),
							templateId: rpgTemplates.id,
							values:
								sql<RecordValues>`${JSON.stringify(input.values)}::jsonb`.as(
									"values",
								),
							createdAt: sql<Date>`now()`.as("created_at"),
							updatedAt: sql<Date>`now()`.as("updated_at"),
						})
						.from(rpgTemplates)
						.where(templateScope(owner, templateId)),
				)
				.returning();
			return row ?? null;
		});
	}
	async list(
		owner: string,
		templateId: string,
		query: ListRecordsQuery,
	): Promise<RecordPage | null> {
		const [template] = await db
			.select({ id: rpgTemplates.id })
			.from(rpgTemplates)
			.where(templateScope(owner, templateId));
		if (!template) return null;
		const rows = await db
			.select()
			.from(rpgRecords)
			.where(
				and(
					eq(rpgRecords.templateId, templateId),
					inArray(rpgRecords.templateId, ownedTemplates(owner)),
					query.cursor ? gt(rpgRecords.id, query.cursor) : undefined,
				),
			)
			.orderBy(rpgRecords.id)
			.limit(query.limit + 1);
		const items = rows.slice(0, query.limit);
		return {
			items,
			...(rows.length > query.limit
				? { nextCursor: items[items.length - 1].id }
				: {}),
		};
	}
	async find(owner: string, id: string): Promise<RpgRecord | null> {
		const [row] = await db
			.select()
			.from(rpgRecords)
			.where(recordScope(owner, id));
		return row ?? null;
	}
	async update(
		owner: string,
		id: string,
		input: UpdateRecord,
	): Promise<RpgRecord | null> {
		return db.transaction(async (tx) => {
			const [location] = await tx
				.select({ templateId: rpgRecords.templateId })
				.from(rpgRecords)
				.where(recordScope(owner, id));
			if (!location) return null;
			const [template] = await tx
				.select()
				.from(rpgTemplates)
				.where(templateScope(owner, location.templateId))
				.for("update");
			if (!template) return null;
			const [current] = await tx
				.select()
				.from(rpgRecords)
				.where(recordScope(owner, id));
			if (!current) return null;
			if (
				input.values === undefined ||
				isDeepStrictEqual(current.values, input.values)
			)
				return current;
			const issues = validateRecordValues(input.values, template.fields);
			if (issues.length) throw new InvalidRecordValuesError(issues);
			const [row] = await tx
				.update(rpgRecords)
				.set({ values: input.values, updatedAt: new Date() })
				.where(recordScope(owner, id))
				.returning();
			return row ?? null;
		});
	}
	async delete(owner: string, id: string): Promise<boolean> {
		return db.transaction(async (tx) => {
			const [location] = await tx
				.select({ templateId: rpgRecords.templateId })
				.from(rpgRecords)
				.where(recordScope(owner, id));
			if (!location) return false;
			const [template] = await tx
				.select({ id: rpgTemplates.id })
				.from(rpgTemplates)
				.where(templateScope(owner, location.templateId))
				.for("update");
			if (!template) return false;
			return (
				(
					await tx
						.delete(rpgRecords)
						.where(recordScope(owner, id))
						.returning({ id: rpgRecords.id })
				).length > 0
			);
		});
	}
}
