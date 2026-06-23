import {
  pgTable,
  text,
  timestamp,
  varchar,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const supportTicketsTable = pgTable("support_tickets", {
  id: varchar("id", { length: 32 }).primaryKey(),
  subject: text("subject").notNull(),
  status: text("status", { enum: ["open", "pending", "resolved"] })
    .notNull()
    .default("open"),
  priority: text("priority", { enum: ["low", "normal", "high", "urgent"] })
    .notNull()
    .default("normal"),
  requesterName: text("requester_name").notNull(),
  requesterRole: text("requester_role", { enum: ["rider", "driver"] }).notNull(),
  requesterEmail: text("requester_email"),
  requesterPhone: text("requester_phone"),
  requesterAvatarUrl: text("requester_avatar_url"),
  tripId: varchar("trip_id", { length: 64 }),
  tripOrigin: text("trip_origin"),
  tripDestination: text("trip_destination"),
  tripDepartureAt: timestamp("trip_departure_at", { withTimezone: true }),
  tripDriverName: text("trip_driver_name"),
  tripPriceCents: integer("trip_price_cents"),
  assigneeId: varchar("assignee_id", { length: 32 }),
  firstAgentResponseAt: timestamp("first_agent_response_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSupportTicketSchema = createInsertSchema(
  supportTicketsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicketRow = typeof supportTicketsTable.$inferSelect;
