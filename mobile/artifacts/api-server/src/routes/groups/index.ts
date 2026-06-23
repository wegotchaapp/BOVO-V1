import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  db,
  tripGroupMembersTable,
  tripGroupMessagesTable,
  tripGroupsTable,
  tripsTable,
  usersTable,
} from "@workspace/db";
import { PostGroupMessageBody } from "@workspace/api-zod";
import { requireUser } from "../../middlewares/require-user";
import { getHubById, type PickupHub } from "../../services/pickup-hubs";

function pickupHubMeta(hub: PickupHub | undefined) {
  if (!hub) return null;
  return {
    hubId: hub.id,
    brand: hub.brand,
    storeName: hub.storeName,
    address: hub.address,
    city: hub.city,
    latitude: hub.latitude,
    longitude: hub.longitude,
  };
}

const router: IRouter = Router();

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | TxClient;

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function groupSummaryDto(row: {
  group: { id: string; tripId: string; pickupHubId: string | null; pickupLocked: boolean; createdAt: Date };
  trip: { fromCity: string; toCity: string; departureAt: Date };
  memberCount: number;
  latestMessage: string | null;
}) {
  return {
    id: row.group.id,
    tripId: row.group.tripId,
    fromCity: row.trip.fromCity,
    toCity: row.trip.toCity,
    departureAt: row.trip.departureAt.toISOString(),
    memberCount: row.memberCount,
    pickupLocked: row.group.pickupLocked,
    pickupHubId: row.group.pickupHubId,
    // Embed the resolved hub so clients (list + detail, locked or not) can
    // render storeName/address without needing the suggestions array, which
    // is empty post-lock.
    pickupHub: row.group.pickupHubId
      ? pickupHubMeta(getHubById(row.group.pickupHubId))
      : null,
    latestMessage: row.latestMessage,
    createdAt: row.group.createdAt.toISOString(),
  };
}

/**
 * Resolve a group + verify membership in one query. Returns `null` if the
 * user isn't a member; callers should treat that as a 404 to avoid leaking
 * existence. Pass a tx to participate in an outer transaction.
 */
async function loadGroupForMember(
  conn: DbOrTx,
  groupId: string,
  userId: string,
) {
  const [self] = await conn
    .select({
      group: tripGroupsTable,
      trip: tripsTable,
    })
    .from(tripGroupMembersTable)
    .innerJoin(tripGroupsTable, eq(tripGroupsTable.id, tripGroupMembersTable.groupId))
    .innerJoin(tripsTable, eq(tripsTable.id, tripGroupsTable.tripId))
    .where(
      and(
        eq(tripGroupMembersTable.groupId, groupId),
        eq(tripGroupMembersTable.userId, userId),
      ),
    );
  return self ?? null;
}

/**
 * Build the full group detail DTO. Shared between GET /:id and POST /pickup/approve
 * so the client gets identical shape back and can drop the new state directly
 * into local state.
 */
async function buildGroupDetail(
  conn: DbOrTx,
  self: NonNullable<Awaited<ReturnType<typeof loadGroupForMember>>>,
  currentUserId: string,
) {
  const groupId = self.group.id;

  const memberRows = await conn
    .select({
      userId: tripGroupMembersTable.userId,
      role: tripGroupMembersTable.role,
      joinedAt: tripGroupMembersTable.joinedAt,
      name: usersTable.name,
    })
    .from(tripGroupMembersTable)
    .innerJoin(usersTable, eq(usersTable.id, tripGroupMembersTable.userId))
    .where(eq(tripGroupMembersTable.groupId, groupId));

  const messageRows = await conn
    .select({
      id: tripGroupMessagesTable.id,
      senderId: tripGroupMessagesTable.senderId,
      text: tripGroupMessagesTable.text,
      isSystem: tripGroupMessagesTable.isSystem,
      createdAt: tripGroupMessagesTable.createdAt,
    })
    .from(tripGroupMessagesTable)
    .where(eq(tripGroupMessagesTable.groupId, groupId))
    .orderBy(tripGroupMessagesTable.createdAt);

  const nameByUserId = new Map(memberRows.map((m) => [m.userId, m.name]));

  return {
    group: groupSummaryDto({
      group: self.group,
      trip: self.trip,
      memberCount: memberRows.length,
      latestMessage: messageRows.length > 0 ? messageRows[messageRows.length - 1]!.text : null,
    }),
    members: memberRows.map((m) => ({
      userId: m.userId,
      name: m.name,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
    messages: messageRows.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.senderId ? nameByUserId.get(m.senderId) ?? null : null,
      text: m.text,
      isSystem: m.isSystem,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

// ─── GET /api/groups/mine ─────────────────────────────────────────────────────
router.get("/mine", requireUser, async (req, res): Promise<void> => {
  const userId = req.authUser!.id;

  const groupRows = await db
    .select({
      group: tripGroupsTable,
      trip: tripsTable,
    })
    .from(tripGroupMembersTable)
    .innerJoin(tripGroupsTable, eq(tripGroupsTable.id, tripGroupMembersTable.groupId))
    .innerJoin(tripsTable, eq(tripsTable.id, tripGroupsTable.tripId))
    .where(eq(tripGroupMembersTable.userId, userId))
    .orderBy(desc(tripGroupsTable.createdAt));

  if (groupRows.length === 0) {
    res.json({ groups: [] });
    return;
  }

  const groupIds = groupRows.map((g) => g.group.id);

  const memberCounts = await db
    .select({
      groupId: tripGroupMembersTable.groupId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(tripGroupMembersTable)
    .where(inArray(tripGroupMembersTable.groupId, groupIds))
    .groupBy(tripGroupMembersTable.groupId);
  const countMap = new Map(memberCounts.map((c) => [c.groupId, c.count]));

  const messages = await db
    .select({
      id: tripGroupMessagesTable.id,
      groupId: tripGroupMessagesTable.groupId,
      text: tripGroupMessagesTable.text,
      createdAt: tripGroupMessagesTable.createdAt,
    })
    .from(tripGroupMessagesTable)
    .where(inArray(tripGroupMessagesTable.groupId, groupIds))
    .orderBy(desc(tripGroupMessagesTable.createdAt));
  const latestMap = new Map<string, string>();
  for (const m of messages) {
    if (!latestMap.has(m.groupId)) latestMap.set(m.groupId, m.text);
  }

  const groups = groupRows.map((r) =>
    groupSummaryDto({
      group: r.group,
      trip: r.trip,
      memberCount: countMap.get(r.group.id) ?? 0,
      latestMessage: latestMap.get(r.group.id) ?? null,
    }),
  );

  res.json({ groups });
});

// ─── GET /api/groups/:id ──────────────────────────────────────────────────────
router.get("/:id", requireUser, async (req, res): Promise<void> => {
  const groupId = String(req.params.id);
  const userId = req.authUser!.id;

  const self = await loadGroupForMember(db, groupId, userId);
  if (!self) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  res.json(await buildGroupDetail(db, self, userId));
});

// ─── POST /api/groups/:id/messages ────────────────────────────────────────────
router.post("/:id/messages", requireUser, async (req, res): Promise<void> => {
  const groupId = String(req.params.id);
  const userId = req.authUser!.id;

  const parsed = PostGroupMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    return;
  }
  const text = parsed.data.text.trim();
  if (!text) {
    res.status(400).json({ error: "Message text cannot be empty." });
    return;
  }

  const self = await loadGroupForMember(db, groupId, userId);
  if (!self) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const [inserted] = await db
    .insert(tripGroupMessagesTable)
    .values({
      id: newId("gmsg"),
      groupId,
      senderId: userId,
      text,
      isSystem: false,
    })
    .returning();

  // Look up sender name once for the response payload.
  const [sender] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  res.status(201).json({
    message: {
      id: inserted.id,
      senderId: inserted.senderId,
      senderName: sender?.name ?? null,
      text: inserted.text,
      isSystem: inserted.isSystem,
      createdAt: inserted.createdAt.toISOString(),
    },
  });
});

// ─── DELETE /api/groups/:id ───────────────────────────────────────────────────
// Only the Voyager (driver member) may dissolve the group. Deletes messages,
// members, and the group row in a single transaction so there are no orphans.
router.delete("/:id", requireUser, async (req, res): Promise<void> => {
  const groupId = String(req.params.id);
  const userId = req.authUser!.id;

  // Verify the caller is a member AND is the driver.
  const [membership] = await db
    .select({ role: tripGroupMembersTable.role })
    .from(tripGroupMembersTable)
    .where(
      and(
        eq(tripGroupMembersTable.groupId, groupId),
        eq(tripGroupMembersTable.userId, userId),
      ),
    );

  if (!membership) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  if (membership.role !== "driver") {
    res.status(403).json({ error: "Only the Voyager can delete this group." });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(tripGroupMessagesTable)
      .where(eq(tripGroupMessagesTable.groupId, groupId));
    await tx
      .delete(tripGroupMembersTable)
      .where(eq(tripGroupMembersTable.groupId, groupId));
    await tx
      .delete(tripGroupsTable)
      .where(eq(tripGroupsTable.id, groupId));
  });

  res.json({ ok: true });
});

class GroupError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export default router;
