import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  tripGroupMembersTable,
  tripGroupMessagesTable,
  tripGroupsTable,
  usersTable,
  type TripRow,
} from "@workspace/db";

type TxClient = Parameters<Parameters<typeof import("@workspace/db").db.transaction>[0]>[0];

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

/**
 * After payment, add the Voyager and paying Sailor to the Adventure group so
 * they can coordinate privately. One group per trip; riders join as they pay.
 *
 * Must be called inside the same transaction as the booking insert/seat
 * decrement. Idempotent for existing members.
 */
export async function ensureGroupForBooking(
  tx: TxClient,
  trip: TripRow,
  riderId: string,
): Promise<string> {
  const [existing] = await tx
    .select({ id: tripGroupsTable.id })
    .from(tripGroupsTable)
    .where(eq(tripGroupsTable.tripId, trip.id));

  let groupId = existing?.id ?? null;
  const isNewGroup = !groupId;

  if (!groupId) {
    groupId = newId("grp");
    await tx.insert(tripGroupsTable).values({
      id: groupId,
      tripId: trip.id,
    });
  }

  const ensureMember = async (
    userId: string,
    role: "driver" | "rider",
  ): Promise<boolean> => {
    const [member] = await tx
      .select({ id: tripGroupMembersTable.id })
      .from(tripGroupMembersTable)
      .where(
        and(
          eq(tripGroupMembersTable.groupId, groupId!),
          eq(tripGroupMembersTable.userId, userId),
        ),
      );
    if (member) return false;
    await tx.insert(tripGroupMembersTable).values({
      id: newId("gm"),
      groupId: groupId!,
      userId,
      role,
    });
    return true;
  };

  await ensureMember(trip.driverId, "driver");
  const riderAdded = await ensureMember(riderId, "rider");

  if (isNewGroup) {
    await tx.insert(tripGroupMessagesTable).values({
      id: newId("gmsg"),
      groupId,
      senderId: null,
      text: "Your Adventure group is ready! Use this chat to coordinate pickup after booking.",
      isSystem: true,
    });
  } else if (riderAdded) {
    const [rider] = await tx
      .select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, riderId));
    const firstName = rider?.name?.split(" ")[0] ?? "A sailor";
    await tx.insert(tripGroupMessagesTable).values({
      id: newId("gmsg"),
      groupId,
      senderId: null,
      text: `${firstName} joined the Adventure group after booking.`,
      isSystem: true,
    });
  }

  return groupId;
}
