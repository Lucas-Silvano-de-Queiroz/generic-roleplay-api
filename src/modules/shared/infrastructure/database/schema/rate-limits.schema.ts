import {
	index,
	integer,
	pgTable,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
export const rateLimits = pgTable(
	"rate_limits",
	{
		key: varchar("key", { length: 64 }).primaryKey(),
		count: integer("count").notNull(),
		resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
	},
	(table) => [index("rate_limits_reset_at_idx").on(table.resetAt)],
);
