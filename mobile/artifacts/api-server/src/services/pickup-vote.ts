import { and, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  tripGroupMembersTable,
  tripGroupMessagesTable,
  tripGroupPickupApprovalsTable,
  tripGroupsTable,
} from "@workspace/db";
import { getHubById } from "./pickup-hubs";

type TxClient = Parameters<Parameters<typeof import("@workspace/db").db.transaction>[0]>[0];

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

/** "More than half" — the standard simple-majority rule. */
export function majorityNeeded(memberCount: number): number {
  return Math.floor(memberCount / 2) + 1;
}

/**
 * Record (or replace) a member's pickup-hub vote. If this vote pushes the
 * winning hub past majority, the group is locked atomically: pickup_hub_id is
 * set, pickup_locked is flipped to true, and a system message is appended.
 *
 * Returns the locked hub id if locking occurred, otherwise null.
 *
 * Caller is responsible for ensuring:
 *   - the user is a member of the group
 *   - the group is not already locked
 *   - the hub id is valid
 */
export async function recordPickupVote(
  tx: TxClient,
  opts: { groupId: string; userId: string; hubId: string },
): Promise<{ lockedHubId: string | null }> {
  const { groupId, userId, hubId } = opts;

  // Serialize concurrent voters on this group. Without this, two members
  // voting at the same moment could both observe "not yet at threshold" or
  // both attempt to flip pickup_locked. Locking the trip_groups row first
  // forces the second vote to wait until the first commit is visible.
  await tx
    .select({ id: tripGroupsTable.id })
    .from(tripGroupsTable)
    .where(eq(tripGroupsTable.id, groupId))
    .for("update");

  // Upsert vote: one row per (groupId, userId).
  await tx
    .insert(tripGroupPickupApprovalsTable)
    .values({
      id: newId("ga"),
      groupId,
      userId,
      hubId,
    })
    .onConflictDoUpdate({
      target: [
        tripGroupPickupApprovalsTable.groupId,
        tripGroupPickupApprovalsTable.userId,
      ],
      set: { hubId, createdAt: new Date() },
    });

  // Tally votes for the *current* members only (so a member who left after
  // voting doesn't haunt the count).
  const memberCountRow = await tx
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(tripGroupMembersTable)
    .where(eq(tripGroupMembersTable.groupId, groupId));
  const memberCount = memberCountRow[0]?.count ?? 0;
  const threshold = majorityNeeded(memberCount);

  const tally = await tx
    .select({
      hubId: tripGroupPickupApprovalsTable.hubId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(tripGroupPickupApprovalsTable)
    .innerJoin(
      tripGroupMembersTable,
      and(
        eq(tripGroupMembersTable.groupId, tripGroupPickupApprovalsTable.groupId),
        eq(tripGroupMembersTable.userId, tripGroupPickupApprovalsTable.userId),
      ),
    )
    .where(eq(tripGroupPickupApprovalsTable.groupId, groupId))
    .groupBy(tripGroupPickupApprovalsTable.hubId);

  const winner = tally.find((t) => t.count >= threshold);
  if (!winner) return { lockedHubId: null };

  await tx
    .update(tripGroupsTable)
    .set({ pickupHubId: winner.hubId, pickupLocked: true })
    .where(eq(tripGroupsTable.id, groupId));

  const hub = getHubById(winner.hubId);
  const label = hub ? `${hub.storeName} — ${hub.address}` : winner.hubId;
  await tx.insert(tripGroupMessagesTable).values({
    id: newId("gmsg"),
    groupId,
    senderId: null,
    text: `Pickup hub locked: ${label}`,
    isSystem: true,
  });

  return { lockedHubId: winner.hubId };
}

/**
 * Aggregate vote counts per hub for a group, intersected with the current
 * member roster so stale votes from removed members are ignored.
 */
export async function tallyApprovals(
  tx: TxClient,
  groupId: string,
): Promise<{ hubId: string; count: number }[]> {
  const rows = await tx
    .select({
      hubId: tripGroupPickupApprovalsTable.hubId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(tripGroupPickupApprovalsTable)
    .innerJoin(
      tripGroupMembersTable,
      and(
        eq(tripGroupMembersTable.groupId, tripGroupPickupApprovalsTable.groupId),
        eq(tripGroupMembersTable.userId, tripGroupPickupApprovalsTable.userId),
      ),
    )
    .where(eq(tripGroupPickupApprovalsTable.groupId, groupId))
    .groupBy(tripGroupPickupApprovalsTable.hubId);
  return rows.map((r) => ({ hubId: r.hubId, count: r.count }));
}
