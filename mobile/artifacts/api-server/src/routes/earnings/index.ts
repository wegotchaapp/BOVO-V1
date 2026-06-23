import { Router, type IRouter } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, driverTripsTable, type DriverTripRow } from "@workspace/db";
import {
  GetEarningsResponse,
  GetEarningsQueryParams,
} from "@workspace/api-zod";
import { requireUser } from "../../middlewares/require-user";

const router: IRouter = Router();

/**
 * Returns the UTC instant corresponding to the first moment of the current
 * month in Texas (America/Chicago). WeGotcha is a Texas-only service, so we
 * pin the calendar boundary to Central Time regardless of server locale.
 */
function startOfCurrentMonthCentralAsUtc(): Date {
  const TZ = "America/Chicago";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const year = get("year");
  const month = get("month");
  // Find UTC midnight that maps to local Y-M-01 00:00:00 in Central Time.
  // Local offset from UTC for Texas is either -5h (CDT) or -6h (CST); we
  // probe both and pick the one whose CT projection lands on the 1st 00:00.
  for (const offsetHours of [5, 6]) {
    const candidate = new Date(
      Date.UTC(year, month - 1, 1, offsetHours, 0, 0, 0),
    );
    const proj = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(candidate);
    const pget = (t: string) => Number(proj.find((p) => p.type === t)!.value);
    if (
      pget("year") === year &&
      pget("month") === month &&
      pget("day") === 1 &&
      pget("hour") === 0 &&
      pget("minute") === 0
    ) {
      return candidate;
    }
  }
  // Fallback: never expected, but degrade gracefully to UTC start-of-month.
  return new Date(Date.UTC(year, month - 1, 1));
}

function tripToDto(t: DriverTripRow) {
  return {
    id: t.id,
    fromCity: t.fromCity,
    toCity: t.toCity,
    miles: t.miles,
    seatsBooked: t.seatsBooked,
    grossAmount: Number(t.grossAmount),
    platformFee: Number(t.platformFee),
    netAmount: Number(t.netAmount),
    completedAt: t.completedAt.toISOString(),
  };
}

router.get("/", requireUser, async (req, res): Promise<void> => {
  const parsed = GetEarningsQueryParams.safeParse({
    period: req.query.period ?? "month",
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid period" });
    return;
  }
  const period = parsed.data.period;
  const driverId = req.authUser!.id;

  const filters = [eq(driverTripsTable.driverId, driverId)];
  if (period === "month") {
    filters.push(
      gte(driverTripsTable.completedAt, startOfCurrentMonthCentralAsUtc()),
    );
  }

  const rows = await db
    .select()
    .from(driverTripsTable)
    .where(and(...filters))
    .orderBy(desc(driverTripsTable.completedAt));

  const trips = rows.map(tripToDto);
  const totalMiles = trips.reduce((s, t) => s + t.miles, 0);
  const grossTotal = trips.reduce((s, t) => s + t.grossAmount, 0);
  const platformFeeTotal = trips.reduce((s, t) => s + t.platformFee, 0);
  const netTotal = trips.reduce((s, t) => s + t.netAmount, 0);

  res.json(
    GetEarningsResponse.parse({
      period,
      tripCount: trips.length,
      totalMiles,
      grossTotal,
      platformFeeTotal,
      netTotal,
      trips,
    }),
  );
});

export default router;
