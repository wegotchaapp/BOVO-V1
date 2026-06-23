import type { Request, Response, NextFunction } from "express";
import type { SupportAgentRow } from "@workspace/db";
import { getSessionAgent } from "../lib/session";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      agent?: SupportAgentRow;
    }
  }
}

export async function requireAgent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const agent = await getSessionAgent(req);
  if (!agent) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.agent = agent;
  next();
}
