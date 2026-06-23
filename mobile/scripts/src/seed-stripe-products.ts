import Stripe from "stripe";

const PRODUCT_NAME = "Bovogo Premium";
const MONTHLY_AMOUNT = 2200; // $22.00 in cents

interface ConnectionSettings {
  settings: { publishable: string; secret: string };
}

async function getStripeSecretKey(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;
  if (!xReplitToken) throw new Error("X-Replit-Token not found");

  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
  });
  const data = (await response.json()) as { items?: ConnectionSettings[] };
  const cs = data.items?.[0];
  if (!cs?.settings?.secret) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }
  return cs.settings.secret;
}

async function main(): Promise<void> {
  const stripe = new Stripe(await getStripeSecretKey(), {
    apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
  });

  // Idempotent: skip if product already exists.
  const search = await stripe.products.search({
    query: `name:'${PRODUCT_NAME}' AND active:'true'`,
    limit: 1,
  });
  let product = search.data[0];
  if (product) {
    console.log(`[seed] product exists: ${product.id} (${product.name})`);
  } else {
    product = await stripe.products.create({
      name: PRODUCT_NAME,
      description:
        "Bovogo Premium — priority matching, no service fees, and Voyager perks.",
      metadata: { tier: "premium" },
    });
    console.log(`[seed] created product: ${product.id}`);
  }

  // Check for existing $22/mo recurring price
  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 100,
  });
  const monthly = prices.data.find(
    (p) =>
      p.unit_amount === MONTHLY_AMOUNT &&
      p.recurring?.interval === "month" &&
      p.currency === "usd",
  );
  if (monthly) {
    console.log(`[seed] price exists: ${monthly.id} ($${(monthly.unit_amount ?? 0) / 100}/mo)`);
  } else {
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: MONTHLY_AMOUNT,
      currency: "usd",
      recurring: { interval: "month" },
      metadata: { plan: "monthly" },
    });
    console.log(`[seed] created price: ${price.id} ($22/mo)`);
  }

  console.log("[seed] done");
}

main().catch((err: unknown) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
