import {
	boolean,
	index,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.schema";
export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		tokenHash: varchar("token_hash", { length: 64 }).notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		revoked: boolean("revoked").notNull().default(false),
	},
	(table) => [
		index("sessions_user_id_idx").on(table.userId),
		index("sessions_expires_at_idx").on(table.expiresAt),
	],
);
