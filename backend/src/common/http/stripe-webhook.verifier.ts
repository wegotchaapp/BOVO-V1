import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import Stripe from 'stripe';

export const STRIPE_WEBHOOK_API_VERSION = '2025-02-24.acacia';

/**
 * Signature verification is a local HMAC over the request bytes — it never
 * calls the Stripe API — so the client only needs to exist. A placeholder key
 * keeps a webhook receiver constructible on an instance that has no
 * `STRIPE_SECRET_KEY`; the *webhook* secret is what gates the endpoint, and a
 * missing one is rejected below rather than waved through.
 */
export function createStripeWebhookClient(secretKey?: string | null): Stripe {
  return new Stripe(secretKey || 'sk_signature_verification_only', {
    apiVersion: STRIPE_WEBHOOK_API_VERSION,
  });
}

export interface StripeWebhookVerification {
  stripe: Stripe;
  rawBody: unknown;
  signature: unknown;
  secret: string | undefined | null;
  /** Names the endpoint in operator-facing errors, e.g. 'Stripe Connect'. */
  source: string;
  /** Env var an operator has to set; quoted in the misconfiguration error. */
  secretVar: string;
}

/**
 * Verifies a Stripe webhook against the raw request bytes and returns the
 * parsed event.
 *
 * There is deliberately no "no secret configured, trust the body" path: an
 * unauthenticated `/payments/webhook` lets anyone mint a
 * `payment_intent.succeeded` and move money through the platform's own
 * bookkeeping. A missing secret is a 500 (the server is misconfigured and
 * Stripe should retry), a missing or bad signature is a 400.
 */
export function verifyStripeWebhook({
  stripe,
  rawBody,
  signature,
  secret,
  source,
  secretVar,
}: StripeWebhookVerification): Stripe.Event {
  if (!secret) {
    throw new InternalServerErrorException(
      `${source} webhook secret is not configured. Set ${secretVar}; the endpoint refuses unverified events.`,
    );
  }

  if (typeof signature !== 'string' || signature.length === 0) {
    throw new BadRequestException('Missing stripe-signature header');
  }

  if (!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') {
    throw new BadRequestException(
      `${source} webhook raw body unavailable — signature cannot be verified.`,
    );
  }

  try {
    return stripe.webhooks.constructEvent(
      rawBody as Buffer | string,
      signature,
      secret,
    );
  } catch {
    throw new BadRequestException(`Invalid ${source} webhook signature`);
  }
}
