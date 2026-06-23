import { pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Tracks when each user last read the replies on a trip post.
 * Unread count = replies created after last_read_at that weren't by this user.
 */
export const tripReplyReadsTable = pgTable(
  "trip_reply_reads",
  {
    userId: varchar("user_id", { length: 32 }).notNull(),
    tripId: varchar("trip_id", { length: 32 }).notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tripId] })],
);

export type TripReplyReadRow = typeof tripReplyReadsTable.$inferSelect;
export type TripReplyReadInsert = typeof tripReplyReadsTable.$inferInsert;
