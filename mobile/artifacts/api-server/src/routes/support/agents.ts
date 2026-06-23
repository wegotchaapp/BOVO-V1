import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, supportAgentsTable } from "@workspace/db";
import {
  ListSupportAgentsResponse,
  CreateSupportAgentBody,
} from "@workspace/api-zod";
import { hashPassword } from "../../lib/password";
import { newId } from "../../lib/ids";
import { agentToDto } from "./serializers";

const router: IRouter = Router();

router.get("/", async (_req, res): Promise<void> => {
  const agents = await db.select().from(supportAgentsTable);
  res.json(ListSupportAgentsResponse.parse(agents.map(agentToDto)));
});

router.post("/", async (req, res): Promise<void> => {
  const parsed = CreateSupportAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, email, password, role } = parsed.data;
  const lower = email.toLowerCase();
  const existing = await db
    .select()
    .from(supportAgentsTable)
    .where(eq(supportAgentsTable.email, lower))
    .limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "An agent with that email already exists" });
    return;
  }
  const id = newId("agt");
  const passwordHash = hashPassword(password);
  const [created] = await db
    .insert(supportAgentsTable)
    .values({ id, name, email: lower, passwordHash, role: role ?? "agent" })
    .returning();
  res.status(201).json(agentToDto(created!));
});

export default router;
