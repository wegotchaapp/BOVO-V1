import { sql } from "drizzle-orm";
import { db, type UserRow } from "@workspace/db";
import { getUncachableStripeClient } from "../lib/stripeClient";
import { logger } from "../lib/logger";

export const BOVOGO_PREMIUM_PRODUCT_NAME = "Bovogo Premium";
export const BOVOGO_PREMIUM_MONTHLY_AMOUNT = 2200; // $22.00 in cents
export const FOUNDING_MEMBER_TRIAL_DAYS = 365;

export interface SubscriptionSnapshot {
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Query the synced stripe.subscriptions table (managed by stripe-replit-sync).
 * Returns null fields when the user has no subscription or Stripe isn't initialized.
 */
export async function getSubscriptionSnapshot(
  user: UserRow,
): Promise<SubscriptionSnapshot> {
  if (!user.stripeSubscriptionId) {
    return {
      status: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
  try {
    // Read from the local synced stripe schema. Columns vary by stripe-replit-sync
    // version; use defensive SELECT with COALESCE on common shapes.
    const result = await db.execute(sql`
      SELECT status,
             trial_end,
             current_period_end,
             cancel_at_period_end
      FROM stripe.subscriptions
      WHERE id = ${user.stripeSubscriptionId}
      LIMIT 1
    `);
    const row = (result as { rows?: Array<Record<string, unknown>> }).rows?.[0];
    if (!row) {
      // Local sync hasn't caught up yet (webhook just fired). Fall back to a
      // direct Stripe API read so /auth/me reflects the current state right
      // after subscription creation. The webhook will populate stripe.* tables
      // within a few seconds, and subsequent reads use the fast local copy.
      return await fetchSnapshotFromStripe(user.stripeSubscriptionId);
    }
    const toIso = (v: unknown): string | null => {
      if (v == null) return null;
      if (v instanceof Date) return v.toISOString();
      if (typeof v === "number")
        return new Date((v < 1e12 ? v * 1000 : v)).toISOString();
      if (typeof v === "string") return v;
      return null;
    };
    return {
      status: typeof row.status === "string" ? row.status : null,
      trialEndsAt: toIso(row.trial_end),
      currentPeriodEnd: toIso(row.current_period_end),
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    };
  } catch (err) {
    logger.warn(
      { err, subId: user.stripeSubscriptionId },
      "subscription snapshot query failed",
    );
    return {
      status: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
}

async function fetchSnapshotFromStripe(
  subscriptionId: string,
): Promise<SubscriptionSnapshot> {
  try {
    const stripe = await getUncachableStripeClient();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const toIso = (t: number | null | undefined): string | null =>
      t ? new Date(t * 1000).toISOString() : null;
    // current_period_end lives on the subscription item in recent API versions.
    const item = sub.items?.data?.[0] as
      | { current_period_end?: number | null }
      | undefined;
    return {
      status: sub.status,
      trialEndsAt: toIso(sub.trial_end),
      currentPeriodEnd: toIso(item?.current_period_end),
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    };
  } catch (err) {
    logger.warn({ err, subscriptionId }, "stripe API fallback failed");
    return {
      status: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }
}

/**
 * Find the active monthly price for Bovogo Premium from the synced stripe schema.
 * Falls back to a live Stripe API search if the local copy isn't ready yet.
 */
export async function findPremiumPriceId(): Promise<string | null> {
  try {
    const result = await db.execute(sql`
      SELECT pr.id
      FROM stripe.prices pr
      JOIN stripe.products p ON p.id = pr.product
      WHERE p.active = true
        AND pr.active = true
        AND p.name = ${BOVOGO_PREMIUM_PRODUCT_NAME}
        AND pr.unit_amount = ${BOVOGO_PREMIUM_MONTHLY_AMOUNT}
      ORDER BY pr.created DESC
      LIMIT 1
    `);
    const rows = (result as { rows?: Array<Record<string, unknown>> }).rows;
    const id = rows?.[0]?.id;
    if (typeof id === "string") return id;
  } catch (err) {
    logger.warn({ err }, "stripe.prices lookup failed, falling back to API");
  }
  // Fallback: query Stripe API directly.
  const stripe = await getUncachableStripeClient();
  const products = await stripe.products.search({
    query: `name:'${BOVOGO_PREMIUM_PRODUCT_NAME}' AND active:'true'`,
    limit: 1,
  });
  const product = products.data[0];
  if (!product) return null;
  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 10,
  });
  const monthly = prices.data.find(
    (p) =>
      p.unit_amount === BOVOGO_PREMIUM_MONTHLY_AMOUNT &&
      p.recurring?.interval === "month",
  );
  return monthly?.id ?? null;
}
