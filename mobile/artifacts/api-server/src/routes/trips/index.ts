import { Router, type IRouter } from "express";
import { and, asc, eq, gte, ilike, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  db,
  tripsTable,
  tripRepliesTable,
  tripReplyReadsTable,
  usersTable,
  type TripRow,
  type TripReplyRow,
} from "@workspace/db";
import {
  GetTripsResponse,
  CreateTripBody,
  GetTripResponse,
  CreateTripReplyBody,
} from "@workspace/api-zod";
import { requireUser } from "../../middlewares/require-user";

const router: IRouter = Router();

// Single MVP corridor for launch.
const MVP_CITIES = new Set(["Austin, TX", "Houston, TX"]);
const MVP_CITIES_LIST = ["Austin, TX", "Houston, TX"];

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

interface DriverSummary {
  id: string;
  name: string;
  rating: number;
  trips: number;
  isTopDriver: boolean;
}

function driverFromUserRow(u: {
  id: string;
  name: string;
  rating: string | number;
  trips: number;
}): DriverSummary {
  const rating = typeof u.rating === "string" ? Number(u.rating) : u.rating;
  return {
    id: u.id,
    name: u.name,
    rating,
    trips: u.trips,
    isTopDriver: rating >= 4.85 && u.trips >= 20,
  };
}

function tripToDto(
  t: TripRow,
  driver: DriverSummary,
  replyCount: number,
) {
  return {
    id: t.id,
    driver,
    fromCity: t.fromCity,
    toCity: t.toCity,
    departureAt: t.departureAt.toISOString(),
    seatsAvailable: t.seatsAvailable,
    luggageSpace: t.luggageSpace,
    pricePerSeat: Number(t.pricePerSeat),
    note: t.note,
    car: t.car ?? "",
    preferences: {
      smoking: t.prefSmoking,
      pets: t.prefPets,
      music: t.prefMusic,
      ac: t.prefAc,
    },
    status: t.status as "active" | "cancelled" | "completed",
    replyCount,
    createdAt: t.createdAt.toISOString(),
  };
}

function replyToDto(r: TripReplyRow, isDriverReply: boolean, userName: string) {
  return {
    id: r.id,
    userId: r.userId,
    userName,
    text: r.text,
    isDriverReply,
    createdAt: r.createdAt.toISOString(),
  };
}

// ─── GET /api/trips ───────────────────────────────────────────────────────────
router.get("/", requireUser, async (req, res): Promise<void> => {
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const afterDateRaw =
    typeof req.query.afterDate === "string" ? req.query.afterDate : undefined;

  const filters = [
    eq(tripsTable.status, "active"),
    // Hard-enforce MVP scope regardless of any legacy rows.
    inArray(tripsTable.fromCity, MVP_CITIES_LIST),
    inArray(tripsTable.toCity, MVP_CITIES_LIST),
  ];
  if (from) filters.push(ilike(tripsTable.fromCity, from));
  if (to) filters.push(ilike(tripsTable.toCity, to));
  if (afterDateRaw) {
    const d = new Date(afterDateRaw);
    if (!Number.isNaN(d.getTime())) {
      filters.push(gte(tripsTable.departureAt, d));
    }
  } else {
    // Default: only future trips.
    filters.push(gte(tripsTable.departureAt, new Date()));
  }

  const rows = await db
    .select({
      trip: tripsTable,
      driver: {
        id: usersTable.id,
        name: usersTable.name,
        rating: usersTable.rating,
        trips: usersTable.trips,
      },
    })
    .from(tripsTable)
    .innerJoin(usersTable, eq(usersTable.id, tripsTable.driverId))
    .where(and(...filters))
    .orderBy(asc(tripsTable.departureAt))
    .limit(50);

  // Reply counts in one query.
  const tripIds = rows.map((r) => r.trip.id);
  const counts = new Map<string, number>();
  if (tripIds.length > 0) {
    const replyRows = await db
      .select({ tripId: tripRepliesTable.tripId })
      .from(tripRepliesTable);
    for (const r of replyRows) {
      counts.set(r.tripId, (counts.get(r.tripId) ?? 0) + 1);
    }
  }

  const trips = rows.map((r) =>
    tripToDto(r.trip, driverFromUserRow(r.driver), counts.get(r.trip.id) ?? 0),
  );

  // Echo response through generated zod for runtime safety (dates → ISO strings
  // are coerced back to Date for shape validation).
  res.json({ trips });
  void GetTripsResponse; // keep import-tracked for future runtime validation
});

// ─── POST /api/trips ──────────────────────────────────────────────────────────
router.post("/", requireUser, async (req, res): Promise<void> => {
  const parsed = CreateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid trip data", details: parsed.error.flatten() });
    return;
  }
  const body = parsed.data;
  const departureDate = body.departureAt instanceof Date
    ? body.departureAt
    : new Date(body.departureAt);

  if (!MVP_CITIES.has(body.fromCity) || !MVP_CITIES.has(body.toCity)) {
    res.status(400).json({
      error: "Only Austin, TX ↔ Houston, TX is available right now. Other cities are coming soon.",
    });
    return;
  }
  if (body.fromCity === body.toCity) {
    res.status(400).json({ error: "From and To must be different cities." });
    return;
  }

  if (Number.isNaN(departureDate.getTime())) {
    res.status(400).json({ error: "Invalid departureAt timestamp" });
    return;
  }
  if (departureDate.getTime() < Date.now() - 60_000) {
    res.status(400).json({ error: "Departure must be in the future." });
    return;
  }

  const driverId = req.authUser!.id;
  const id = newId("tr");

  const [inserted] = await db
    .insert(tripsTable)
    .values({
      id,
      driverId,
      fromCity: body.fromCity,
      toCity: body.toCity,
      departureAt: departureDate,
      seatsAvailable: body.seatsAvailable,
      luggageSpace: body.luggageSpace ?? 0,
      pricePerSeat: body.pricePerSeat.toFixed(2),
      note: body.note ?? "",
      car: body.car ?? null,
      prefSmoking: body.preferences?.smoking ?? false,
      prefPets: body.preferences?.pets ?? false,
      prefMusic: body.preferences?.music ?? true,
      prefAc: body.preferences?.ac ?? true,
    })
    .returning();

  const [driverRow] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      rating: usersTable.rating,
      trips: usersTable.trips,
    })
    .from(usersTable)
    .where(eq(usersTable.id, driverId));

  res.status(201).json({
    trip: tripToDto(inserted, driverFromUserRow(driverRow), 0),
  });
});

// ─── GET /api/trips/mine ──────────────────────────────────────────────────────
// All trips posted by the caller, regardless of status / departure date / MVP
// city. Powers the driver side of the "My Trips" tab.
router.get("/mine", requireUser, async (req, res): Promise<void> => {
  const driverId = req.authUser!.id;
  const rows = await db
    .select({
      trip: tripsTable,
      driver: {
        id: usersTable.id,
        name: usersTable.name,
        rating: usersTable.rating,
        trips: usersTable.trips,
      },
    })
    .from(tripsTable)
    .innerJoin(usersTable, eq(usersTable.id, tripsTable.driverId))
    .where(eq(tripsTable.driverId, driverId))
    .orderBy(asc(tripsTable.departureAt));

  const tripIds = rows.map((r) => r.trip.id);
  const counts = new Map<string, number>();
  if (tripIds.length > 0) {
    const replyRows = await db
      .select({ tripId: tripRepliesTable.tripId })
      .from(tripRepliesTable);
    for (const r of replyRows) {
      counts.set(r.tripId, (counts.get(r.tripId) ?? 0) + 1);
    }
  }
  const trips = rows.map((r) =>
    tripToDto(r.trip, driverFromUserRow(r.driver), counts.get(r.trip.id) ?? 0),
  );
  res.json({ trips });
});

// ─── GET /api/trips/:id ───────────────────────────────────────────────────────
router.get("/:id", requireUser, async (req, res): Promise<void> => {
  const tripId = String(req.params.id);
  const [row] = await db
    .select({
      trip: tripsTable,
      driver: {
        id: usersTable.id,
        name: usersTable.name,
        rating: usersTable.rating,
        trips: usersTable.trips,
      },
    })
    .from(tripsTable)
    .innerJoin(usersTable, eq(usersTable.id, tripsTable.driverId))
    .where(eq(tripsTable.id, tripId));

  if (!row) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const replyRows = await db
    .select({
      reply: tripRepliesTable,
      authorName: usersTable.name,
    })
    .from(tripRepliesTable)
    .innerJoin(usersTable, eq(usersTable.id, tripRepliesTable.userId))
    .where(eq(tripRepliesTable.tripId, tripId))
    .orderBy(asc(tripRepliesTable.createdAt));

  const replies = replyRows.map((rr) =>
    replyToDto(rr.reply, rr.reply.userId === row.trip.driverId, rr.authorName),
  );

  res.json({
    trip: tripToDto(row.trip, driverFromUserRow(row.driver), replies.length),
    replies,
  });
  void GetTripResponse;
});

// ─── DELETE /api/trips/:id ────────────────────────────────────────────────────
// Voyager (driver) cancels their own posted Adventure. Status is flipped to
// `cancelled` rather than hard-deleted so reply/booking history is preserved.
router.delete("/:id", requireUser, async (req, res): Promise<void> => {
  const tripId = String(req.params.id);
  const userId = req.authUser!.id;

  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.id, tripId));

  if (!trip) {
    res.status(404).json({ error: "Adventure not found" });
    return;
  }
  if (trip.driverId !== userId) {
    res.status(403).json({ error: "You can only cancel your own adventures." });
    return;
  }
  if (trip.status === "cancelled") {
    res.json({ ok: true });
    return;
  }

  await db
    .update(tripsTable)
    .set({ status: "cancelled" })
    .where(eq(tripsTable.id, tripId));

  res.json({ ok: true });
});

// ─── POST /api/trips/:id/mark-read ───────────────────────────────────────────
// Upserts the caller's last-read timestamp for a trip's reply thread. The
// client calls this when the user opens a post's reply detail view. Once
// recorded, that trip will no longer count toward the unread badge until a
// newer reply arrives.
router.post("/:id/mark-read", requireUser, async (req, res): Promise<void> => {
  const tripId = String(req.params.id);
  const userId = req.authUser!.id;

  await db
    .insert(tripReplyReadsTable)
    .values({ userId, tripId, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [tripReplyReadsTable.userId, tripReplyReadsTable.tripId],
      set: { lastReadAt: new Date() },
    });

  res.json({ ok: true });
});

// ─── POST /api/trips/:id/replies ──────────────────────────────────────────────
router.post("/:id/replies", requireUser, async (req, res): Promise<void> => {
  const parsed = CreateTripReplyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid reply" });
    return;
  }
  const tripId = String(req.params.id);

  const [trip] = await db
    .select()
    .from(tripsTable)
    .where(eq(tripsTable.id, tripId));
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const userId = req.authUser!.id;
  const id = newId("rp");

  const [inserted] = await db
    .insert(tripRepliesTable)
    .values({
      id,
      tripId,
      userId,
      text: parsed.data.text.trim(),
    })
    .returning();

  const [author] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  res.status(201).json({
    reply: replyToDto(inserted, userId === trip.driverId, author?.name ?? "Unknown"),
  });
});

export default router;
