import type { Request } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db, userSessionsTable, usersTable } from "@workspace/db";
import type { UserRow } from "@workspace/db";
import { newSessionId } from "./ids";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export async function createUserSession(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const id = newSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(userSessionsTable).values({ id, userId, expiresAt });
  return { token: id, expiresAt };
}

export async function destroyUserSession(token: string): Promise<void> {
  await db.delete(userSessionsTable).where(eq(userSessionsTable.id, token));
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function getSessionUser(req: Request): Promise<UserRow | null> {
  const token = extractToken(req);
  if (!token) return null;
  const rows = await db
    .select({ user: usersTable })
    .from(userSessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, userSessionsTable.userId))
    .where(
      and(
        eq(userSessionsTable.id, token),
        gt(userSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0]?.user ?? null;
}

export function getTokenFromRequest(req: Request): string | null {
  return extractToken(req);
}
