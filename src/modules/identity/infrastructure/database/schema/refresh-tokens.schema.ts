import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users.schema";

export const refreshTokens = pgTable(
	"refresh_tokens",
	{
		tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		index("refresh_tokens_user_id_idx").on(table.userId),
		index("refresh_tokens_expires_at_idx").on(table.expiresAt),
	],
);
