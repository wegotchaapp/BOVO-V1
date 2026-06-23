import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const userSessionsTable = pgTable("user_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type UserSessionRow = typeof userSessionsTable.$inferSelect;
