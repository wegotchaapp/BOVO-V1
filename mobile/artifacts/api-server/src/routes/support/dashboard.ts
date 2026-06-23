import { Router, type IRouter } from "express";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db, supportTicketsTable } from "@workspace/db";
import { GetSupportDashboardOverviewResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/overview", async (_req, res): Promise<void> => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [counts] = await db
    .select({
      open: sql<number>`count(*) filter (where status = 'open')::int`,
      pending: sql<number>`count(*) filter (where status = 'pending')::int`,
      resolved: sql<number>`count(*) filter (where status = 'resolved')::int`,
    })
    .from(supportTicketsTable);

  const [unassigned] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(supportTicketsTable)
    .where(
      and(
        isNull(supportTicketsTable.assigneeId),
        sql`${supportTicketsTable.status} <> 'resolved'`,
      ),
    );

  const [resolvedToday] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(supportTicketsTable)
    .where(
      and(
        eq(supportTicketsTable.status, "resolved"),
        gte(supportTicketsTable.updatedAt, startOfToday),
      ),
    );

  const [avg] = await db
    .select({
      mins: sql<
        number | null
      >`avg(extract(epoch from (first_agent_response_at - created_at)) / 60.0)`,
    })
    .from(supportTicketsTable);

  const byPriorityRows = await db
    .select({
      priority: supportTicketsTable.priority,
      count: sql<number>`count(*)::int`,
    })
    .from(supportTicketsTable)
    .groupBy(supportTicketsTable.priority);

  const priorities: Array<"low" | "normal" | "high" | "urgent"> = [
    "low",
    "normal",
    "high",
    "urgent",
  ];
  const byPriority = priorities.map((p) => ({
    priority: p,
    count: byPriorityRows.find((r) => r.priority === p)?.count ?? 0,
  }));

  const avgMinsRaw = avg?.mins;
  const avgMins =
    avgMinsRaw === null || avgMinsRaw === undefined
      ? null
      : Math.round(Number(avgMinsRaw) * 10) / 10;

  res.json(
    GetSupportDashboardOverviewResponse.parse({
      openCount: counts?.open ?? 0,
      pendingCount: counts?.pending ?? 0,
      resolvedCount: counts?.resolved ?? 0,
      unassignedCount: unassigned?.c ?? 0,
      resolvedTodayCount: resolvedToday?.c ?? 0,
      avgFirstResponseMinutes: avgMins,
      byPriority,
    }),
  );
});

export default router;
