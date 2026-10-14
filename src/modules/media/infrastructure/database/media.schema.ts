import { sql } from "drizzle-orm";
import {
	bigserial,
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { users } from "modules/identity/infrastructure/database/schema/users.schema";
import {
	rpgCollections,
	rpgSystems,
} from "modules/rpg-content/infrastructure/database/schema/rpg-content.schema";
import { rpgRecords } from "modules/rpg-content/infrastructure/database/schema/rpg-records.schema";

export const mediaAssets = pgTable(
	"media_assets",
	{
		id: uuid("id").primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		kind: varchar("kind", { length: 24 }).notNull(),
		systemId: uuid("system_id").references(() => rpgSystems.id, {
			onDelete: "cascade",
		}),
		collectionId: uuid("collection_id").references(() => rpgCollections.id, {
			onDelete: "cascade",
		}),
		recordId: uuid("record_id").references(() => rpgRecords.id, {
			onDelete: "cascade",
		}),
		expectedCoverMediaId: uuid("expected_cover_media_id"),
		bucket: text("bucket").notNull(),
		fileName: varchar("file_name", { length: 255 }).notNull(),
		declaredContentType: varchar("declared_content_type", {
			length: 32,
		}).notNull(),
		declaredSizeBytes: integer("declared_size_bytes").notNull(),
		checksumSha256: varchar("checksum_sha256", { length: 44 }).notNull(),
		alt: varchar("alt", { length: 500 }).notNull().default(""),
		state: varchar("state", { length: 16 }).notNull(),
		temporaryKey: text("temporary_key").notNull(),
		uploadExpiresAt: timestamp("upload_expires_at", {
			withTimezone: true,
		}).notNull(),
		completeBefore: timestamp("complete_before", {
			withTimezone: true,
		}).notNull(),
		attemptId: uuid("attempt_id"),
		processToken: uuid("process_token"),
		leaseUntil: timestamp("lease_until", { withTimezone: true }),
		finalKey: text("final_key"),
		outputSizeBytes: integer("output_size_bytes"),
		width: integer("width"),
		height: integer("height"),
		outputChecksumSha256: varchar("output_checksum_sha256", { length: 44 }),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		check(
			"media_assets_kind_check",
			sql`${table.kind} in ('system-cover', 'collection-cover', 'record-image')`,
		),
		check(
			"media_assets_state_check",
			sql`${table.state} in ('pending', 'processing', 'ready')`,
		),
		check(
			"media_assets_destination_check",
			sql`(
			(${table.kind} = 'system-cover' and ${table.systemId} is not null and ${table.collectionId} is null and ${table.recordId} is null) or
			(${table.kind} = 'collection-cover' and ${table.systemId} is null and ${table.collectionId} is not null and ${table.recordId} is null) or
			(${table.kind} = 'record-image' and ${table.systemId} is null and ${table.collectionId} is null and ${table.recordId} is not null)
		)`,
		),
		check(
			"media_assets_size_check",
			sql`${table.declaredSizeBytes} between 1 and 10485760`,
		),
		index("media_assets_user_state_idx").on(table.userId, table.state),
		check(
			"media_assets_ready_metadata_check",
			sql`${table.state} <> 'ready' or (${table.finalKey} is not null and ${table.outputSizeBytes} between 1 and 10485760 and ${table.width} > 0 and ${table.height} > 0 and ${table.publishedAt} is not null)`,
		),
		index("media_assets_record_published_idx")
			.on(table.recordId, table.publishedAt, table.id)
			.where(sql`${table.state} = 'ready'`),
	],
);

export const mediaAttempts = pgTable(
	"media_processing_attempts",
	{
		attemptId: uuid("attempt_id").primaryKey(),
		mediaId: uuid("media_id")
			.notNull()
			.references(() => mediaAssets.id, { onDelete: "cascade" }),
		objectKey: text("object_key").notNull(),
		leaseUntil: timestamp("lease_until", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("media_attempts_media_id_idx").on(table.mediaId)],
);

export const mediaCleanupOutbox = pgTable(
	"media_cleanup_outbox",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		bucket: text("bucket").notNull(),
		objectKey: text("object_key").notNull(),
		notBefore: timestamp("not_before", { withTimezone: true }).notNull(),
		leaseUntil: timestamp("lease_until", { withTimezone: true }),
		leaseToken: uuid("lease_token"),
		attempts: integer("attempts").notNull().default(0),
		nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		lastFailureCode: varchar("last_failure_code", { length: 64 }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		unique("media_cleanup_bucket_key_unique").on(table.bucket, table.objectKey),
		index("media_cleanup_due_idx").on(table.nextAttemptAt, table.notBefore),
	],
);

export const mediaRateLimits = pgTable(
	"media_rate_limits",
	{
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		scope: varchar("scope", { length: 24 }).notNull(),
		windowStartedAt: timestamp("window_started_at", {
			withTimezone: true,
		}).notNull(),
		requestCount: integer("request_count").notNull(),
	},
	(table) => [
		unique("media_rate_limits_user_scope_unique").on(table.userId, table.scope),
	],
);
