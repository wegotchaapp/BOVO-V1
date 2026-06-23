import {
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const supportTicketMessagesTable = pgTable("support_ticket_messages", {
  id: varchar("id", { length: 32 }).primaryKey(),
  ticketId: varchar("ticket_id", { length: 32 }).notNull(),
  body: text("body").notNull(),
  authorType: text("author_type", {
    enum: ["customer", "agent", "system"],
  }).notNull(),
  authorName: text("author_name").notNull(),
  authorAgentId: varchar("author_agent_id", { length: 32 }),
  internal: boolean("internal").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSupportTicketMessageSchema = createInsertSchema(
  supportTicketMessagesTable,
).omit({ id: true, createdAt: true });
export type InsertSupportTicketMessage = z.infer<
  typeof insertSupportTicketMessageSchema
>;
export type SupportTicketMessageRow =
  typeof supportTicketMessagesTable.$inferSelect;
