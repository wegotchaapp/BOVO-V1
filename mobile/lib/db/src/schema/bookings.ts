import {
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Rider bookings on driver-posted trips.
 *
 * A booking represents N seats reserved by a rider on a single trip.
 * Creating a booking atomically decrements `trips.seatsAvailable` and
 * captures the price snapshot (so later edits to the trip don't retroactively
 * change what the rider paid).
 *
 * Payment is mock for MVP — `paymentMethod` records the rider's selection
 * but no charge is performed. When real Stripe lands we'll add a payment_ref
 * column without breaking the existing shape.
 */
export const bookingsTable = pgTable(
  "bookings",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    tripId: varchar("trip_id", { length: 32 }).notNull(),
    riderId: varchar("rider_id", { length: 32 }).notNull(),
    seats: integer("seats").notNull(),
    /** Snapshot of trip.pricePerSeat at booking time. */
    pricePerSeat: numeric("price_per_seat", { precision: 10, scale: 2 }).notNull(),
    /** Platform service fee (flat or % of subtotal). */
    serviceFee: numeric("service_fee", { precision: 10, scale: 2 }).notNull().default("0"),
    /** seats * pricePerSeat + serviceFee. */
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    /** "card" | "apple" | "venmo" — mock for MVP. */
    paymentMethod: varchar("payment_method", { length: 16 }).notNull(),
    /** "confirmed" | "cancelled" | "completed" */
    status: varchar("status", { length: 16 }).notNull().default("confirmed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("bookings_rider_idx").on(t.riderId),
    index("bookings_trip_idx").on(t.tripId),
    index("bookings_status_idx").on(t.status),
  ],
);

export type BookingRow = typeof bookingsTable.$inferSelect;
export type BookingInsert = typeof bookingsTable.$inferInsert;
