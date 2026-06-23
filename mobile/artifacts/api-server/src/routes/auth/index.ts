import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, type UserRow } from "@workspace/db";
import { getSubscriptionSnapshot } from "../../services/subscriptions";

const FOUNDING_MEMBER_LIMIT = 10_000;
import {
  AuthLoginBody,
  AuthLoginResponse,
  AuthRegisterBody,
  AuthRegisterResponse,
  AuthLogoutResponse,
  AuthMeResponse,
  AuthUpdateMeBody,
  AuthUpdateMeResponse,
} from "@workspace/api-zod";
import { hashPassword, verifyPassword } from "../../lib/password";
import { newId } from "../../lib/ids";
import {
  createUserSession,
  destroyUserSession,
  getTokenFromRequest,
} from "../../lib/user-session";
import { requireUser } from "../../middlewares/require-user";

const router: IRouter = Router();

// Brute-force / abuse protection. Counts ALL requests (including failed ones).
const isDev = process.env.NODE_ENV !== "production";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 attempts per IP per window
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: "Too many login attempts. Try again in a few minutes." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5, // 5 new accounts per IP per hour
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: "Too many accounts created from this device. Try again later." },
});

async function userToDto(u: UserRow) {
  const sub = await getSubscriptionSnapshot(u);
  // Note: orval's zod coerce.date() turns null into new Date(0). We must
  // OMIT trialEndsAt when null rather than pass it through.
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role ?? null,
    rating: Number(u.rating),
    trips: u.trips,
    isVerified: u.isVerified,
    onboarded: u.onboarded,
    isFoundingMember: u.isFoundingMember,
    subscriptionStatus: sub.status,
    ...(sub.trialEndsAt ? { trialEndsAt: sub.trialEndsAt } : {}),
  };
}

router.post("/register", registerLimiter, async (req, res): Promise<void> => {
  const parsed = AuthRegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { name, email, phone, password } = parsed.data;
  const emailLower = email.toLowerCase();

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, emailLower))
    .limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const id = newId("u");
  const passwordHash = hashPassword(password);

  // Auto-grant founding-member status to the first 10,000 accounts.
  // We count before insert (the new row makes count == limit for the 10,000th user).
  const [{ count: priorCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable);
  const isFoundingMember = priorCount < FOUNDING_MEMBER_LIMIT;

  await db.insert(usersTable).values({
    id,
    name,
    email: emailLower,
    phone,
    passwordHash,
    isFoundingMember,
  });
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  const user = rows[0]!;
  const { token } = await createUserSession(user.id);
  res.json(AuthRegisterResponse.parse({ user: await userToDto(user), token }));
});

router.post("/login", loginLimiter, async (req, res): Promise<void> => {
  const parsed = AuthLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { email, password } = parsed.data;
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const { token } = await createUserSession(user.id);
  res.json(AuthLoginResponse.parse({ user: await userToDto(user), token }));
});

router.post("/logout", async (req, res): Promise<void> => {
  const token = getTokenFromRequest(req);
  if (token) await destroyUserSession(token);
  res.json(AuthLogoutResponse.parse({ ok: true }));
});

router.get("/me", requireUser, async (req, res): Promise<void> => {
  res.json(AuthMeResponse.parse(await userToDto(req.authUser!)));
});

router.patch("/me", requireUser, async (req, res): Promise<void> => {
  const parsed = AuthUpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.onboarded !== undefined)
    updates.onboarded = parsed.data.onboarded;
  // `isVerified` is intentionally NOT writable here. Verification must be
  // granted server-side by a real ID-check flow, never by the client.
  // `isFoundingMember` is likewise intentionally NOT writable here — it is
  // auto-granted at registration based on the first-10k user-count check.
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;

  if (Object.keys(updates).length > 0) {
    await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, req.authUser!.id));
  }
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.authUser!.id))
    .limit(1);
  res.json(AuthUpdateMeResponse.parse(await userToDto(rows[0]!)));
});

export default router;
