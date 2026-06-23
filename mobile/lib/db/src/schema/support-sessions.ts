import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const supportSessionsTable = pgTable("support_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  agentId: varchar("agent_id", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export type SupportSessionRow = typeof supportSessionsTable.$inferSelect;
