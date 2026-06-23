import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const supportAgentsTable = pgTable("support_agents", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "agent"] }).notNull().default("agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSupportAgentSchema = createInsertSchema(
  supportAgentsTable,
).omit({ id: true, createdAt: true });
export type InsertSupportAgent = z.infer<typeof insertSupportAgentSchema>;
export type SupportAgentRow = typeof supportAgentsTable.$inferSelect;
