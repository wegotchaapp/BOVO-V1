import { logger } from "./logger";
import { getStripeSync } from "./stripeClient";

export async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL required");
  }

  try {
    const mod = (await import("stripe-replit-sync")) as {
      runMigrations: (opts: { databaseUrl: string }) => Promise<void>;
    };
    await mod.runMigrations({ databaseUrl });

    const sync = await getStripeSync();

    const replitDomains = process.env.REPLIT_DOMAINS;
    const firstDomain = replitDomains?.split(",")[0];
    if (firstDomain) {
      const webhookUrl = `https://${firstDomain}/api/stripe/webhook`;
      await sync.findOrCreateManagedWebhook(webhookUrl);
      logger.info({ webhookUrl }, "stripe managed webhook ready");
    } else {
      logger.warn("REPLIT_DOMAINS not set — skipping managed webhook setup");
    }

    await sync.syncBackfill();
    logger.info("stripe syncBackfill complete");
  } catch (err) {
    logger.error({ err }, "stripe init failed (continuing without Stripe)");
  }
}
