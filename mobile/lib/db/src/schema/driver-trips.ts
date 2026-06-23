import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Completed driver trips — the source of truth for earnings/savings.
 * One row per completed trip; populated when a booking finishes (rider
 * is dropped off and payment settles).
 *
 * Amounts are stored as numeric strings to avoid floating-point loss.
 * `grossAmount` is the sum collected from all riders for this trip,
 * `platformFee` is the WeGotcha service fee, `netAmount` is what the
 * driver actually keeps (gross − fee).
 */
export const driverTripsTable = pgTable(
  "driver_trips",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    driverId: varchar("driver_id", { length: 32 }).notNull(),
    fromCity: text("from_city").notNull(),
    toCity: text("to_city").notNull(),
    miles: integer("miles").notNull(),
    seatsBooked: integer("seats_booked").notNull(),
    grossAmount: numeric("gross_amount", { precision: 10, scale: 2 }).notNull(),
    platformFee: numeric("platform_fee", { precision: 10, scale: 2 }).notNull(),
    netAmount: numeric("net_amount", { precision: 10, scale: 2 }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("driver_trips_driver_completed_idx").on(t.driverId, t.completedAt),
  ],
);

export type DriverTripRow = typeof driverTripsTable.$inferSelect;
