import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * One row per member per group recording their current pickup hub vote.
 *
 * Voting is "change-your-mind" — when a member approves a different hub we
 * overwrite their existing row (enforced by the unique index on group+user).
 * When the count for any single hub crosses majority (`floor(n/2)+1` of the
 * current member count), the group's `pickup_hub_id` is set and
 * `pickup_locked` flips to true.
 */
export const tripGroupPickupApprovalsTable = pgTable(
  "trip_group_pickup_approvals",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    groupId: varchar("group_id", { length: 32 }).notNull(),
    userId: varchar("user_id", { length: 32 }).notNull(),
    hubId: text("hub_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("trip_group_pickup_approvals_uniq").on(t.groupId, t.userId),
  ],
);

export type TripGroupPickupApprovalRow =
  typeof tripGroupPickupApprovalsTable.$inferSelect;
export type TripGroupPickupApprovalInsert =
  typeof tripGroupPickupApprovalsTable.$inferInsert;
