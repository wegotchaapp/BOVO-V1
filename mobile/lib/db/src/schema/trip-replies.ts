import {
  index,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Conversational replies on a driver's trip post. Riders ask questions,
 * the driver answers. Stored newest-last; `isDriverReply` (derived at API
 * time by comparing user_id to the parent trip's driver_id) is not stored
 * here to keep the source of truth on the trip row.
 */
export const tripRepliesTable = pgTable(
  "trip_replies",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    tripId: varchar("trip_id", { length: 32 }).notNull(),
    userId: varchar("user_id", { length: 32 }).notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("trip_replies_trip_created_idx").on(t.tripId, t.createdAt),
  ],
);

export type TripReplyRow = typeof tripRepliesTable.$inferSelect;
export type TripReplyInsert = typeof tripRepliesTable.$inferInsert;
