import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  db,
  supportTicketsTable,
  supportTicketMessagesTable,
  supportAgentsTable,
} from "@workspace/db";
import {
  ListSupportTicketsQueryParams,
  ListSupportTicketsResponse,
  GetSupportTicketParams,
  GetSupportTicketResponse,
  UpdateSupportTicketParams,
  UpdateSupportTicketBody,
  UpdateSupportTicketResponse,
  PostSupportTicketMessageParams,
  PostSupportTicketMessageBody,
} from "@workspace/api-zod";
import { newId } from "../../lib/ids";
import { ticketSummaryToDto, ticketDetailToDto } from "./serializers";

const router: IRouter = Router();

async function loadTicketDetail(id: string) {
  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, id))
    .limit(1);
  if (!ticket) return null;
  const messages = await db
    .select()
    .from(supportTicketMessagesTable)
    .where(eq(supportTicketMessagesTable.ticketId, id))
    .orderBy(asc(supportTicketMessagesTable.createdAt));
  let assigneeName: string | null = null;
  if (ticket.assigneeId) {
    const [a] = await db
      .select({ name: supportAgentsTable.name })
      .from(supportAgentsTable)
      .where(eq(supportAgentsTable.id, ticket.assigneeId))
      .limit(1);
    assigneeName = a?.name ?? null;
  }
  return ticketDetailToDto(ticket, messages, assigneeName);
}

router.get("/", async (req, res): Promise<void> => {
  const parsed = ListSupportTicketsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { status, priority, assigneeId, search, sort, limit, offset } =
    parsed.data;
  const effectiveSort = sort ?? "updated_desc";
  const effectiveLimit = limit ?? 25;
  const effectiveOffset = offset ?? 0;
  const conds = [];
  if (status) conds.push(eq(supportTicketsTable.status, status));
  if (priority) conds.push(eq(supportTicketsTable.priority, priority));
  if (assigneeId) conds.push(eq(supportTicketsTable.assigneeId, assigneeId));
  if (search) {
    const like = `%${search}%`;
    conds.push(
      or(
        ilike(supportTicketsTable.subject, like),
        ilike(supportTicketsTable.requesterName, like),
      )!,
    );
  }
  const where = conds.length ? and(...conds) : undefined;

  let orderBy;
  switch (effectiveSort) {
    case "updated_asc":
      orderBy = [asc(supportTicketsTable.updatedAt)];
      break;
    case "created_desc":
      orderBy = [desc(supportTicketsTable.createdAt)];
      break;
    case "priority_desc":
      orderBy = [
        sql`case ${supportTicketsTable.priority} when 'urgent' then 4 when 'high' then 3 when 'normal' then 2 when 'low' then 1 else 0 end desc`,
        desc(supportTicketsTable.updatedAt),
      ];
      break;
    case "updated_desc":
    default:
      orderBy = [desc(supportTicketsTable.updatedAt)];
      break;
  }

  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(supportTicketsTable)
    .where(where);

  const rows = await db
    .select()
    .from(supportTicketsTable)
    .where(where)
    .orderBy(...orderBy)
    .limit(effectiveLimit)
    .offset(effectiveOffset);

  const ids = rows.map((r) => r.id);
  const assigneeIds = Array.from(
    new Set(rows.map((r) => r.assigneeId).filter((x): x is string => !!x)),
  );

  const allMessages = ids.length
    ? await db
        .select({
          ticketId: supportTicketMessagesTable.ticketId,
          body: supportTicketMessagesTable.body,
          createdAt: supportTicketMessagesTable.createdAt,
        })
        .from(supportTicketMessagesTable)
        .where(inArray(supportTicketMessagesTable.ticketId, ids))
        .orderBy(desc(supportTicketMessagesTable.createdAt))
    : [];
  const statsById = new Map<
    string,
    { count: number; lastBody: string | null }
  >();
  for (const m of allMessages) {
    const cur = statsById.get(m.ticketId);
    if (!cur) statsById.set(m.ticketId, { count: 1, lastBody: m.body });
    else cur.count += 1;
  }

  const assignees = assigneeIds.length
    ? await db
        .select({ id: supportAgentsTable.id, name: supportAgentsTable.name })
        .from(supportAgentsTable)
        .where(inArray(supportAgentsTable.id, assigneeIds))
    : [];
  const assigneeNameById = new Map(assignees.map((a) => [a.id, a.name]));

  const dto = rows.map((t) => {
    const s = statsById.get(t.id);
    return ticketSummaryToDto(t, {
      assigneeName: t.assigneeId ? assigneeNameById.get(t.assigneeId) ?? null : null,
      lastMessagePreview: s?.lastBody ?? null,
      messageCount: s?.count ?? 0,
    });
  });

  res.setHeader("X-Total-Count", String(totalCount));
  res.setHeader("Access-Control-Expose-Headers", "X-Total-Count");
  res.json(ListSupportTicketsResponse.parse(dto));
});

router.get("/:id", async (req, res): Promise<void> => {
  const parsed = GetSupportTicketParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const detail = await loadTicketDetail(parsed.data.id);
  if (!detail) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json(GetSupportTicketResponse.parse(detail));
});

router.patch("/:id", async (req, res): Promise<void> => {
  const params = UpdateSupportTicketParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateSupportTicketBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (body.data.status !== undefined) updates.status = body.data.status;
  if (body.data.priority !== undefined) updates.priority = body.data.priority;
  if (body.data.assigneeId !== undefined)
    updates.assigneeId = body.data.assigneeId;
  if (Object.keys(updates).length === 0) {
    const detail = await loadTicketDetail(params.data.id);
    if (!detail) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json(UpdateSupportTicketResponse.parse(detail));
    return;
  }
  const result = await db
    .update(supportTicketsTable)
    .set(updates)
    .where(eq(supportTicketsTable.id, params.data.id))
    .returning({ id: supportTicketsTable.id });
  if (!result[0]) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  // Optional system log message for status changes
  if (body.data.status) {
    await db.insert(supportTicketMessagesTable).values({
      id: newId("msg"),
      ticketId: params.data.id,
      authorType: "system",
      authorName: "System",
      body: `Status changed to ${body.data.status}`,
      internal: true,
    });
  }
  const detail = await loadTicketDetail(params.data.id);
  res.json(UpdateSupportTicketResponse.parse(detail));
});

router.post("/:id/messages", async (req, res): Promise<void> => {
  const params = PostSupportTicketMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = PostSupportTicketMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const agent = req.agent;
  if (!agent) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, params.data.id))
    .limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  const internal = body.data.internal ?? false;
  await db.insert(supportTicketMessagesTable).values({
    id: newId("msg"),
    ticketId: params.data.id,
    authorType: "agent",
    authorName: agent.name,
    authorAgentId: agent.id,
    body: body.data.body,
    internal,
  });
  // Touch ticket and record first agent response if applicable
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (!internal && !ticket.firstAgentResponseAt) {
    updates.firstAgentResponseAt = new Date();
  }
  if (!internal && ticket.status === "open") {
    updates.status = "pending";
  }
  await db
    .update(supportTicketsTable)
    .set(updates)
    .where(eq(supportTicketsTable.id, params.data.id));
  const detail = await loadTicketDetail(params.data.id);
  res.status(201).json(detail);
});

export default router;
