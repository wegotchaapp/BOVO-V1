import {
  boolean,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["driver", "rider"] }),
  rating: numeric("rating", { precision: 3, scale: 2 })
    .notNull()
    .default("5.00"),
  trips: integer("trips").notNull().default(0),
  isVerified: boolean("is_verified").notNull().default(false),
  onboarded: boolean("onboarded").notNull().default(false),
  isFoundingMember: boolean("is_founding_member").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserRow = typeof usersTable.$inferSelect;
