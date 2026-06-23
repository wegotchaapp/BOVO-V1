import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  db,
  bookingsTable,
  tripsTable,
  usersTable,
  type BookingRow,
  type TripRow,
} from "@workspace/db";
import { CreateBookingBody } from "@workspace/api-zod";
import { requireUser } from "../../middlewares/require-user";
import { ensureGroupIfFull } from "../../services/trip-groups";

const router: IRouter = Router();

const SERVICE_FEE_RATE = 0.06;

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function bookingToDto(
  b: BookingRow,
  trip: Pick<TripRow, "id" | "fromCity" | "toCity" | "departureAt" | "car">,
  driverName: string,
) {
  return {
    id: b.id,
    tripId: b.tripId,
    riderId: b.riderId,
    seats: b.seats,
    pricePerSeat: Number(b.pricePerSeat),
    serviceFee: Number(b.serviceFee),
    totalAmount: Number(b.totalAmount),
    paymentMethod: b.paymentMethod as "card" | "apple" | "venmo",
    status: b.status as "confirmed" | "cancelled" | "completed",
    createdAt: b.createdAt.toISOString(),
    completedAt: b.completedAt ? b.completedAt.toISOString() : null,
    trip: {
      id: trip.id,
      fromCity: trip.fromCity,
      toCity: trip.toCity,
      departureAt: trip.departureAt.toISOString(),
      driverName,
      car: trip.car ?? "",
    },
  };
}

// ─── POST /api/bookings ───────────────────────────────────────────────────────
router.post("/", requireUser, async (req, res): Promise<void> => {
  const parsed = CreateBookingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid booking data", details: parsed.error.flatten() });
    return;
  }
  const { tripId, seats, paymentMethod } = parsed.data;
  if (!Number.isInteger(seats)) {
    res.status(400).json({ error: "Seats must be a whole number." });
    return;
  }
  const riderId = req.authUser!.id;

  try {
    const dto = await db.transaction(async (tx) => {
      // Lock the trip row to prevent concurrent oversell.
      const [trip] = await tx
        .select()
        .from(tripsTable)
        .where(eq(tripsTable.id, tripId))
        .for("update");

      if (!trip) {
        throw new BookingError(404, "Trip not found");
      }
      if (trip.status !== "active") {
        throw new BookingError(400, "This trip is no longer available.");
      }
      if (trip.driverId === riderId) {
        throw new BookingError(400, "You can't book a seat on your own trip.");
      }
      if (trip.departureAt.getTime() < Date.now() - 60_000) {
        throw new BookingError(400, "This trip has already departed.");
      }
      if (trip.seatsAvailable < seats) {
        throw new BookingError(
          400,
          `Only ${trip.seatsAvailable} seat${trip.seatsAvailable === 1 ? "" : "s"} left on this trip.`,
        );
      }

      const pricePerSeat = Number(trip.pricePerSeat);
      const subtotal = round2(pricePerSeat * seats);
      const serviceFee = round2(subtotal * SERVICE_FEE_RATE);
      const totalAmount = round2(subtotal + serviceFee);

      const newSeatsAvailable = trip.seatsAvailable - seats;
      await tx
        .update(tripsTable)
        .set({ seatsAvailable: newSeatsAvailable })
        .where(eq(tripsTable.id, tripId));

      const id = newId("bk");
      const [inserted] = await tx
        .insert(bookingsTable)
        .values({
          id,
          tripId,
          riderId,
          seats,
          pricePerSeat: pricePerSeat.toFixed(2),
          serviceFee: serviceFee.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          paymentMethod,
          status: "confirmed",
        })
        .returning();

      const [driverRow] = await tx
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, trip.driverId));

      // Auto-create a trip group if this booking just filled the trip.
      // The service no-ops if seatsAvailable > 0 or a group already exists.
      await ensureGroupIfFull(tx, {
        ...trip,
        seatsAvailable: newSeatsAvailable,
      });

      return bookingToDto(inserted, trip, driverRow?.name ?? "Voyager");
    });

    res.status(201).json({ booking: dto });
  } catch (err) {
    if (err instanceof BookingError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Failed to create booking");
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// ─── GET /api/bookings/mine ───────────────────────────────────────────────────
router.get("/mine", requireUser, async (req, res): Promise<void> => {
  const riderId = req.authUser!.id;

  const rows = await db
    .select({
      booking: bookingsTable,
      trip: tripsTable,
      driverName: usersTable.name,
    })
    .from(bookingsTable)
    .innerJoin(tripsTable, eq(tripsTable.id, bookingsTable.tripId))
    .innerJoin(usersTable, eq(usersTable.id, tripsTable.driverId))
    .where(eq(bookingsTable.riderId, riderId))
    .orderBy(desc(bookingsTable.createdAt));

  const bookings = rows.map((r) =>
    bookingToDto(r.booking, r.trip, r.driverName),
  );
  res.json({ bookings });
});

// ─── GET /api/bookings/:id ────────────────────────────────────────────────────
router.get("/:id", requireUser, async (req, res): Promise<void> => {
  const bookingId = String(req.params.id);
  const userId = req.authUser!.id;

  const [row] = await db
    .select({
      booking: bookingsTable,
      trip: tripsTable,
      driverName: usersTable.name,
    })
    .from(bookingsTable)
    .innerJoin(tripsTable, eq(tripsTable.id, bookingsTable.tripId))
    .innerJoin(usersTable, eq(usersTable.id, tripsTable.driverId))
    .where(eq(bookingsTable.id, bookingId));

  if (!row) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  // Only the rider or the driver may view.
  if (row.booking.riderId !== userId && row.trip.driverId !== userId) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  res.json({ booking: bookingToDto(row.booking, row.trip, row.driverName) });
});

class BookingError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Suppress unused-import lint for `sql` placeholder; keeping room for future raw SQL.
void sql;
void and;

export default router;
