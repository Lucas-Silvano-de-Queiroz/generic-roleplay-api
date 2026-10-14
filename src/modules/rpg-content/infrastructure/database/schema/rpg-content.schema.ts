import { sql } from "drizzle-orm";
import {
	check,
	index,
	jsonb,
	pgTable,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { users } from "modules/identity/infrastructure/database/schema/users.schema";
import type { FieldDefinition } from "../../../domain/content.schemas";

const timestamps = () => ({
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const rpgSystems = pgTable(
	"rpg_systems",
	{
		id: uuid("id").primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 100 }).notNull(),
		description: varchar("description", { length: 5000 }),
		...timestamps(),
	},
	(table) => [
		index("rpg_systems_user_id_idx").on(table.userId),
		check("rpg_systems_name_check", sql`length(btrim(${table.name})) > 0`),
	],
);

export const rpgCollections = pgTable(
	"rpg_collections",
	{
		id: uuid("id").primaryKey(),
		systemId: uuid("system_id")
			.notNull()
			.references(() => rpgSystems.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 100 }).notNull(),
		identifier: varchar("identifier", { length: 64 }).notNull(),
		description: varchar("description", { length: 5000 }),
		...timestamps(),
	},
	(table) => [
		index("rpg_collections_system_id_idx").on(table.systemId),
		unique("rpg_collections_system_identifier_unique").on(
			table.systemId,
			table.identifier,
		),
		check(
			"rpg_collections_identifier_check",
			sql`${table.identifier} ~ '^[a-z][a-z0-9_-]*$'`,
		),
		check("rpg_collections_name_check", sql`length(btrim(${table.name})) > 0`),
	],
);

export const rpgTemplates = pgTable(
	"rpg_templates",
	{
		id: uuid("id").primaryKey(),
		collectionId: uuid("collection_id")
			.notNull()
			.references(() => rpgCollections.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 100 }).notNull(),
		identifier: varchar("identifier", { length: 64 }).notNull(),
		description: varchar("description", { length: 5000 }),
		category: varchar("category", { length: 64 }),
		fields: jsonb("fields")
			.$type<FieldDefinition[]>()
			.notNull()
			.default(sql`'[]'::jsonb`),
		...timestamps(),
	},
	(table) => [
		index("rpg_templates_collection_id_idx").on(table.collectionId),
		unique("rpg_templates_collection_identifier_unique").on(
			table.collectionId,
			table.identifier,
		),
		check(
			"rpg_templates_identifier_check",
			sql`${table.identifier} ~ '^[a-z][a-z0-9_-]*$'`,
		),
		check("rpg_templates_name_check", sql`length(btrim(${table.name})) > 0`),
		check(
			"rpg_templates_fields_check",
			sql`CASE WHEN jsonb_typeof(${table.fields}) = 'array' THEN jsonb_array_length(${table.fields}) <= 100 ELSE false END`,
		),
	],
);
