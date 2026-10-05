import { sql } from "drizzle-orm";
import {
	check,
	index,
	jsonb,
	pgTable,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import type { RecordValues } from "../../../domain/records";
import { rpgTemplates } from "./rpg-content.schema";
export const rpgRecords = pgTable(
	"rpg_records",
	{
		id: uuid("id").primaryKey(),
		templateId: uuid("template_id")
			.notNull()
			.references(() => rpgTemplates.id, { onDelete: "cascade" }),
		values: jsonb("values").$type<RecordValues>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		check(
			"rpg_records_values_check",
			sql`jsonb_typeof(${table.values}) = 'object'`,
		),
		index("rpg_records_template_id_id_idx").on(table.templateId, table.id),
	],
);
