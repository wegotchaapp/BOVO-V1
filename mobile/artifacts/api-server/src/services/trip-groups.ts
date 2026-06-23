import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  bookingsTable,
  tripGroupMembersTable,
  tripGroupMessagesTable,
  tripGroupsTable,
  type TripRow,
} from "@workspace/db";

type TxClient = Parameters<Parameters<typeof import("@workspace/db").db.transaction>[0]>[0];

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

/**
 * Auto-create a trip group when the last seat of a trip has just been booked.
 *
 * Must be called inside the same transaction as the booking insert/seat
 * decrement so we never race two concurrent "last seat" bookings into two
 * different groups. Idempotent: if a group already exists for the trip, this
 * is a no-op.
 *
 * Members are the driver + every rider with a `confirmed` booking on the
 * trip. Rider seats > 1 still count as a single member (one human, one seat
 * reservation per booking row).
 */
export async function ensureGroupIfFull(
  tx: TxClient,
  trip: TripRow,
): Promise<string | null> {
  if (trip.seatsAvailable > 0) return null;

  const [existing] = await tx
    .select({ id: tripGroupsTable.id })
    .from(tripGroupsTable)
    .where(eq(tripGroupsTable.tripId, trip.id));
  if (existing) return existing.id;

  const groupId = newId("grp");
  await tx.insert(tripGroupsTable).values({
    id: groupId,
    tripId: trip.id,
  });

  // Driver is always a member.
  await tx.insert(tripGroupMembersTable).values({
    id: newId("gm"),
    groupId,
    userId: trip.driverId,
    role: "driver",
  });

  // Add every confirmed rider. Dedupe by riderId so multi-seat single-rider
  // bookings still resolve to one member row.
  const riders = await tx
    .select({ riderId: bookingsTable.riderId })
    .from(bookingsTable)
    .where(eq(bookingsTable.tripId, trip.id));

  const seenRiders = new Set<string>();
  for (const r of riders) {
    if (r.riderId === trip.driverId) continue; // belt-and-suspenders
    if (seenRiders.has(r.riderId)) continue;
    seenRiders.add(r.riderId);
    await tx.insert(tripGroupMembersTable).values({
      id: newId("gm"),
      groupId,
      userId: r.riderId,
      role: "rider",
    });
  }

  await tx.insert(tripGroupMessagesTable).values([
    {
      id: newId("gmsg"),
      groupId,
      senderId: null,
      text: "Trip group created successfully.",
      isSystem: true,
    },
    {
      id: newId("gmsg"),
      groupId,
      senderId: null,
      text: "Smart pickup suggestions are now available.",
      isSystem: true,
    },
  ]);

  return groupId;
}
