import * as express from 'express';

export type RawBodyRequest = express.Request & { rawBody?: Buffer };

interface ParsedApplication {
  use: (...args: any[]) => unknown;
}

/**
 * Endpoints whose handler verifies a provider signature over the exact bytes
 * that were sent. Re-serialising the parsed object is not equivalent: JSON
 * permits any whitespace between tokens and does not fix key order, so a
 * `JSON.stringify(req.body)` round-trip produces different bytes and a
 * different HMAC for a perfectly authentic payload.
 */
export const RAW_BODY_WEBHOOK_ROUTES: ReadonlyArray<{
  path: string;
  limit: string;
}> = [
  { path: '/payments/webhook', limit: '1mb' },
  { path: '/webhooks/stripe-connect', limit: '1mb' },
  { path: '/webhooks/checkr', limit: '1mb' },
  { path: '/identity/webhook', limit: '5mb' },
  { path: '/safety/noonlight/webhook', limit: '1mb' },
  { path: '/api/background-check/webhook', limit: '1mb' },
];

function captureRawBody(req: RawBodyRequest, _res: unknown, buf: Buffer): void {
  req.rawBody = buf;
}

/**
 * Installs the HTTP body parsers in the only order that works.
 *
 * body-parser marks a request with `_body` once it has consumed the stream and
 * every later parser short-circuits on that flag. A path-scoped parser with a
 * `verify` hook therefore has to be mounted *before* the catch-all
 * `express.json()`, otherwise it never runs and `req.rawBody` is silently
 * undefined — which is how a signature check ends up falling back to trusting
 * the parsed body.
 *
 * Shared between `main.ts` and the webhook tests so the tests exercise the
 * real middleware order rather than a convenient stand-in.
 */
export function registerBodyParsers(app: ParsedApplication): void {
  for (const { path, limit } of RAW_BODY_WEBHOOK_ROUTES) {
    app.use(
      path,
      express.json({
        type: 'application/json',
        limit,
        verify: captureRawBody,
      }),
    );
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
}
