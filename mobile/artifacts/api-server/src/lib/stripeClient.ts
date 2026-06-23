import Stripe from "stripe";

interface ConnectionSettings {
  settings: {
    publishable: string;
    secret: string;
  };
}

async function getCredentials(): Promise<{
  publishableKey: string;
  secretKey: string;
}> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  const connectorName = "stripe";
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", connectorName);
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Replit-Token": xReplitToken,
    },
  });

  const data = (await response.json()) as { items?: ConnectionSettings[] };
  const connectionSettings = data.items?.[0];

  if (
    !connectionSettings ||
    !connectionSettings.settings.publishable ||
    !connectionSettings.settings.secret
  ) {
    throw new Error(`Stripe ${targetEnvironment} connection not found`);
  }

  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret,
  };
}

// WARNING: Never cache this client. Always call this function again to get a fresh client.
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    // Pinned to match stripe-replit-sync's expected version. Cast because the
    // installed `stripe` types ship a newer literal default; the API still
    // accepts older versions at runtime.
    apiVersion: "2025-08-27.basil" as Stripe.LatestApiVersion,
  });
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey(): Promise<string> {
  const { secretKey } = await getCredentials();
  return secretKey;
}

// StripeSync singleton for webhook processing and data sync
let stripeSync: unknown = null;

export async function getStripeSync(): Promise<{
  findOrCreateManagedWebhook: (url: string) => Promise<{ webhook: unknown }>;
  syncBackfill: () => Promise<void>;
  processWebhook: (body: Buffer, signature: string) => Promise<void>;
}> {
  if (!stripeSync) {
    const mod = (await import("stripe-replit-sync")) as {
      StripeSync: new (opts: {
        poolConfig: { connectionString: string; max: number };
        stripeSecretKey: string;
      }) => unknown;
    };
    const secretKey = await getStripeSecretKey();
    stripeSync = new mod.StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return stripeSync as any;
}
