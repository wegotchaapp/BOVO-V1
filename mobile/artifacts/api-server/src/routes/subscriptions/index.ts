import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  StartSubscriptionBody,
  StartSubscriptionResponse,
  GetMySubscriptionResponse,
} from "@workspace/api-zod";
import { requireUser } from "../../middlewares/require-user";
import {
  getUncachableStripeClient,
  getStripePublishableKey,
} from "../../lib/stripeClient";
import {
  findPremiumPriceId,
  getSubscriptionSnapshot,
  FOUNDING_MEMBER_TRIAL_DAYS,
} from "../../services/subscriptions";
import type Stripe from "stripe";

const router: IRouter = Router();

// Statuses where the subscription has not been activated yet — we should let
// the user finish the Payment Sheet rather than block them with a 409.
const RESUMABLE_STATUSES = new Set(["incomplete", "incomplete_expired"]);

function extractClientSecret(
  subscription: Stripe.Subscription,
): string | null {
  const setupIntent = subscription.pending_setup_intent as
    | Stripe.SetupIntent
    | string
    | null
    | undefined;
  if (setupIntent && typeof setupIntent !== "string") {
    return setupIntent.client_secret ?? null;
  }
  const invoice = subscription.latest_invoice as
    | Stripe.Invoice
    | string
    | null
    | undefined;
  if (invoice && typeof invoice !== "string") {
    const pi = (invoice as unknown as { payment_intent?: Stripe.PaymentIntent | string | null })
      .payment_intent;
    if (pi && typeof pi !== "string") {
      return pi.client_secret ?? null;
    }
  }
  return null;
}

router.post("/start", requireUser, async (req, res): Promise<void> => {
  const parsed = StartSubscriptionBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const user = req.authUser!;

  let stripe: Stripe;
  let publishableKey: string;
  try {
    stripe = await getUncachableStripeClient();
    publishableKey = await getStripePublishableKey();
  } catch (err) {
    req.log.error({ err }, "stripe client unavailable");
    res.status(500).json({ error: "Payments are not configured" });
    return;
  }

  // If a subscription already exists, allow resuming it when it's still
  // awaiting payment-method confirmation. Only block when it's actually active.
  if (user.stripeSubscriptionId) {
    try {
      const existing = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId,
        { expand: ["latest_invoice.payment_intent", "pending_setup_intent"] },
      );
      if (RESUMABLE_STATUSES.has(existing.status)) {
        const trialEndsAt = existing.trial_end
          ? new Date(existing.trial_end * 1000).toISOString()
          : null;
        res.json(
          StartSubscriptionResponse.parse({
            subscriptionId: existing.id,
            status: existing.status,
            clientSecret: extractClientSecret(existing),
            publishableKey,
            ...(trialEndsAt ? { trialEndsAt } : {}),
          }),
        );
        return;
      }
      res
        .status(409)
        .json({ error: "Subscription already exists for this user" });
      return;
    } catch (err) {
      // Stale ID (subscription was deleted in Stripe) — clear it and fall
      // through to create a fresh one.
      req.log.warn(
        { err, subscriptionId: user.stripeSubscriptionId },
        "could not retrieve existing subscription; recreating",
      );
      await db
        .update(usersTable)
        .set({ stripeSubscriptionId: null })
        .where(eq(usersTable.id, user.id));
    }
  }

  const priceId = await findPremiumPriceId();
  if (!priceId) {
    res
      .status(500)
      .json({ error: "Bovogo Premium price not found. Run the seed script." });
    return;
  }

  // Ensure a Stripe customer exists for this user.
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: { bovogoUserId: user.id },
    });
    customerId = customer.id;
    await db
      .update(usersTable)
      .set({ stripeCustomerId: customerId })
      .where(eq(usersTable.id, user.id));
  }

  // Founding members get a 1-year free trial.
  const trialDays = user.isFoundingMember ? FOUNDING_MEMBER_TRIAL_DAYS : 0;

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: trialDays > 0 ? trialDays : undefined,
    payment_behavior: "default_incomplete",
    payment_settings: {
      save_default_payment_method: "on_subscription",
    },
    expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
    metadata: {
      bovogoUserId: user.id,
      isFoundingMember: String(user.isFoundingMember),
    },
  });

  await db
    .update(usersTable)
    .set({ stripeSubscriptionId: subscription.id })
    .where(eq(usersTable.id, user.id));

  // When trialing, Stripe creates a SetupIntent (no charge yet); when paying
  // immediately, a PaymentIntent on the first invoice.
  const clientSecret = extractClientSecret(subscription);

  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;

  res.json(
    StartSubscriptionResponse.parse({
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret,
      publishableKey,
      ...(trialEndsAt ? { trialEndsAt } : {}),
    }),
  );
});

// Public publishable key + price metadata. Used by the mobile client to
// initialize StripeProvider before opening the subscription flow. No PII.
router.get("/config", requireUser, async (_req, res): Promise<void> => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch {
    res.status(500).json({ error: "Payments are not configured" });
  }
});

router.get("/me", requireUser, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const snap = await getSubscriptionSnapshot(user);
  res.json(
    GetMySubscriptionResponse.parse({
      hasSubscription: Boolean(user.stripeSubscriptionId),
      ...(snap.status ? { status: snap.status } : {}),
      ...(snap.currentPeriodEnd
        ? { currentPeriodEnd: snap.currentPeriodEnd }
        : {}),
      ...(snap.trialEndsAt ? { trialEndsAt: snap.trialEndsAt } : {}),
      cancelAtPeriodEnd: snap.cancelAtPeriodEnd,
    }),
  );
});

export default router;
