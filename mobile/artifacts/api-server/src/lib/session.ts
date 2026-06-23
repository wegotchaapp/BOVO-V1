import type { Request, Response } from "express";
import { eq, gt, and } from "drizzle-orm";
import { db, supportSessionsTable, supportAgentsTable } from "@workspace/db";
import type { SupportAgentRow } from "@workspace/db";
import { newSessionId } from "./ids";

const COOKIE_NAME = "saferide_support_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export async function createSession(
  res: Response,
  agentId: string,
): Promise<void> {
  const id = newSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(supportSessionsTable).values({ id, agentId, expiresAt });
  res.cookie(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

export async function destroySession(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.cookies?.[COOKIE_NAME];
  if (id) {
    await db.delete(supportSessionsTable).where(eq(supportSessionsTable.id, id));
  }
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export async function getSessionAgent(
  req: Request,
): Promise<SupportAgentRow | null> {
  const id: string | undefined = req.cookies?.[COOKIE_NAME];
  if (!id) return null;
  const rows = await db
    .select({
      agent: supportAgentsTable,
    })
    .from(supportSessionsTable)
    .innerJoin(
      supportAgentsTable,
      eq(supportAgentsTable.id, supportSessionsTable.agentId),
    )
    .where(
      and(
        eq(supportSessionsTable.id, id),
        gt(supportSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0]?.agent ?? null;
}
