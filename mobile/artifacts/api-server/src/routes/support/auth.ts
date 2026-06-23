import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, supportAgentsTable } from "@workspace/db";
import {
  SupportLoginBody,
  SupportLoginResponse,
  SupportMeResponse,
  SupportLogoutResponse,
} from "@workspace/api-zod";
import { verifyPassword } from "../../lib/password";
import { createSession, destroySession, getSessionAgent } from "../../lib/session";
import { agentToDto } from "./serializers";

const router: IRouter = Router();

router.post("/login", async (req, res): Promise<void> => {
  const parsed = SupportLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { email, password } = parsed.data;
  const rows = await db
    .select()
    .from(supportAgentsTable)
    .where(eq(supportAgentsTable.email, email.toLowerCase()))
    .limit(1);
  const agent = rows[0];
  if (!agent || !verifyPassword(password, agent.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  await createSession(res, agent.id);
  res.json(SupportLoginResponse.parse(agentToDto(agent)));
});

router.post("/logout", async (req, res): Promise<void> => {
  await destroySession(req, res);
  res.json(SupportLogoutResponse.parse({ ok: true }));
});

router.get("/me", async (req, res): Promise<void> => {
  const agent = await getSessionAgent(req);
  if (!agent) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(SupportMeResponse.parse(agentToDto(agent)));
});

export default router;
