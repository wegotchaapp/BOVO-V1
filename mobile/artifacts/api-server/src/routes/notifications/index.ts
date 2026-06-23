import { Router, type IRouter } from "express";
import { and, eq, inArray, ne } from "drizzle-orm";
import {
  db,
  tripRepliesTable,
  tripReplyReadsTable,
  tripsTable,
} from "@workspace/db";
import { requireUser } from "../../middlewares/require-user";

const router: IRouter = Router();

// ─── GET /api/notifications/unread ───────────────────────────────────────────
// Returns per-trip unread reply counts for trips where the authenticated user
// is the driver OR has themselves posted a reply. Used by the mobile app to
// drive tab-bar badges and post-card indicators.
router.get("/unread", requireUser, async (req, res): Promise<void> => {
  const userId = req.authUser!.id;

  // Trips the user cares about: ones they drive or have replied to.
  const [driverTripRows, repliedTripRows] = await Promise.all([
    db
      .select({ tripId: tripsTable.id })
      .from(tripsTable)
      .where(eq(tripsTable.driverId, userId)),
    db
      .selectDistinct({ tripId: tripRepliesTable.tripId })
      .from(tripRepliesTable)
      .where(eq(tripRepliesTable.userId, userId)),
  ]);

  const allTripIds = [
    ...new Set([
      ...driverTripRows.map((r) => r.tripId),
      ...repliedTripRows.map((r) => r.tripId),
    ]),
  ];

  if (allTripIds.length === 0) {
    res.json({ unreadTripReplies: [], totalUnread: 0 });
    return;
  }

  // Read all replies for these trips (not by this user) + user's last-read timestamps.
  const [allReplies, readRecords] = await Promise.all([
    db
      .select({
        tripId: tripRepliesTable.tripId,
        createdAt: tripRepliesTable.createdAt,
      })
      .from(tripRepliesTable)
      .where(
        and(
          inArray(tripRepliesTable.tripId, allTripIds),
          ne(tripRepliesTable.userId, userId),
        ),
      ),
    db
      .select()
      .from(tripReplyReadsTable)
      .where(
        and(
          eq(tripReplyReadsTable.userId, userId),
          inArray(tripReplyReadsTable.tripId, allTripIds),
        ),
      ),
  ]);

  const EPOCH = new Date(0);
  const readMap = new Map(readRecords.map((r) => [r.tripId, r.lastReadAt]));

  // Group unread replies by tripId.
  const countByTrip = new Map<string, number>();
  for (const reply of allReplies) {
    const lastRead = readMap.get(reply.tripId) ?? EPOCH;
    if (reply.createdAt > lastRead) {
      countByTrip.set(reply.tripId, (countByTrip.get(reply.tripId) ?? 0) + 1);
    }
  }

  const unreadTripReplies = [...countByTrip.entries()].map(
    ([tripId, unreadCount]) => ({ tripId, unreadCount }),
  );
  const totalUnread = unreadTripReplies.reduce(
    (s, r) => s + r.unreadCount,
    0,
  );

  res.json({ unreadTripReplies, totalUnread });
});

export default router;
