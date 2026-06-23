import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Driver-posted trips (a.k.a. "rides" / "posts" in the UI).
 *
 * A single trip is the unit of supply: a driver announces they're driving
 * from `fromCity` to `toCity` at a specific `departureAt`. Riders see it in
 * the home feed AND in search results, and can either reply with a question
 * (see `trip_replies`) or proceed to book a seat.
 *
 * MVP corridor is enforced at the API layer (Austin ↔ Houston). The DB
 * accepts any string so future cities just require an API-level flag change.
 */
export const tripsTable = pgTable(
  "trips",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    driverId: varchar("driver_id", { length: 32 }).notNull(),
    fromCity: text("from_city").notNull(),
    toCity: text("to_city").notNull(),
    departureAt: timestamp("departure_at", { withTimezone: true }).notNull(),
    seatsAvailable: integer("seats_available").notNull(),
    luggageSpace: integer("luggage_space").notNull().default(0),
    pricePerSeat: numeric("price_per_seat", { precision: 10, scale: 2 }).notNull(),
    note: text("note").notNull().default(""),
    car: text("car"),
    prefSmoking: boolean("pref_smoking").notNull().default(false),
    prefPets: boolean("pref_pets").notNull().default(false),
    prefMusic: boolean("pref_music").notNull().default(true),
    prefAc: boolean("pref_ac").notNull().default(true),
    // "active" | "cancelled" | "completed"
    status: varchar("status", { length: 16 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("trips_route_departure_idx").on(t.fromCity, t.toCity, t.departureAt),
    index("trips_driver_idx").on(t.driverId),
    index("trips_status_departure_idx").on(t.status, t.departureAt),
  ],
);

export type TripRow = typeof tripsTable.$inferSelect;
export type TripInsert = typeof tripsTable.$inferInsert;
