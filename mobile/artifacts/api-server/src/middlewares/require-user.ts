import type { Request, Response, NextFunction } from "express";
import type { UserRow } from "@workspace/db";
import { getSessionUser } from "../lib/user-session";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: UserRow;
    }
  }
}

export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.authUser = user;
  next();
}
