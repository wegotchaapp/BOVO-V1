import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Trip groups are automatically created when a trip's last seat is booked.
 *
 * The group bundles the driver + every confirmed rider into a single
 * collaboration surface for chat and pickup-hub coordination.
 *
 * Invariants:
 *   - exactly one group per trip (enforced by unique index on trip_id)
 *   - members are pinned at creation; if someone later cancels we keep them
 *     in the audit trail and surface "left the trip" via a system message
 *   - `pickupHubId` references a hub id from `lib/pickup-hubs` (string id, not
 *     a DB row) so we can iterate on the hub list without migrations
 */
export const tripGroupsTable = pgTable(
  "trip_groups",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    tripId: varchar("trip_id", { length: 32 }).notNull(),
    pickupHubId: text("pickup_hub_id"),
    pickupLocked: boolean("pickup_locked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("trip_groups_trip_uniq").on(t.tripId)],
);

export type TripGroupRow = typeof tripGroupsTable.$inferSelect;
export type TripGroupInsert = typeof tripGroupsTable.$inferInsert;

export const tripGroupMembersTable = pgTable(
  "trip_group_members",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    groupId: varchar("group_id", { length: 32 }).notNull(),
    userId: varchar("user_id", { length: 32 }).notNull(),
    /** "driver" | "rider" — role inside this trip, not the user's account role. */
    role: varchar("role", { length: 12 }).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("trip_group_members_uniq").on(t.groupId, t.userId),
    index("trip_group_members_user_idx").on(t.userId),
  ],
);

export type TripGroupMemberRow = typeof tripGroupMembersTable.$inferSelect;
export type TripGroupMemberInsert = typeof tripGroupMembersTable.$inferInsert;

export const tripGroupMessagesTable = pgTable(
  "trip_group_messages",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    groupId: varchar("group_id", { length: 32 }).notNull(),
    /** Null when `isSystem = true`. */
    senderId: varchar("sender_id", { length: 32 }),
    text: text("text").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("trip_group_messages_group_idx").on(t.groupId, t.createdAt)],
);

export type TripGroupMessageRow = typeof tripGroupMessagesTable.$inferSelect;
export type TripGroupMessageInsert = typeof tripGroupMessagesTable.$inferInsert;
