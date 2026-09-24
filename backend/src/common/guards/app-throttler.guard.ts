import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { resolveClientIp, trustedProxyHops } from '../http/trusted-proxy';

/**
 * Routes that must never be rate limited by caller IP.
 *
 * Provider callbacks arrive from a handful of provider-owned addresses, so an
 * IP bucket is the wrong control for them — each of these endpoints is
 * authenticated by a signature instead, and a 429 here only delays a signed
 * event (a Noonlight SOS status, a Stripe payout result) behind the provider's
 * retry backoff. Liveness probes are excluded for the same reason: they share
 * the platform's own address.
 */
export const UNTHROTTLED_PATH_PREFIXES = [
  '/health',
  '/webhooks/',
  '/payments/webhook',
  '/identity/webhook',
  '/safety/noonlight/webhook',
  '/api/background-check/webhook',
];

/**
 * Matches on whole path segments, not on a bare string prefix.
 *
 * `startsWith('/health')` also exempts `/healthcheck-flood` and
 * `startsWith('/payments/webhook')` exempts `/payments/webhook-probe` — paths
 * no route serves, but which an unauthenticated caller picks freely and which
 * would then reach the 404 handler with no rate limit in front of them. The
 * exemption is for the specific endpoints listed, so the match ends at a
 * segment boundary.
 */
export function isUnthrottledPath(path: string): boolean {
  const normalized = (path.split('?')[0] || '').replace(/\/+$/, '') || '/';
  return UNTHROTTLED_PATH_PREFIXES.some((prefix) => {
    const base = prefix.replace(/\/+$/, '');
    return normalized === base || normalized.startsWith(`${base}/`);
  });
}

/**
 * The application-wide throttler.
 *
 * `ThrottlerModule.forRoot` on its own registers nothing — without this guard
 * bound as an `APP_GUARD` every `@Throttle` decorator in the codebase is inert
 * metadata. Two behaviours are layered on the stock guard:
 *
 * 1. Only HTTP is throttled. A global guard also runs for Socket.IO message
 *    handlers, where `switchToHttp()` yields no request and the stock tracker
 *    would throw on every realtime message.
 * 2. The tracker uses an explicitly configured proxy depth rather than
 *    whatever `X-Forwarded-For` claims, so a caller cannot rotate the header
 *    to mint a fresh login bucket per attempt.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<{
      originalUrl?: string;
      url?: string;
    }>();
    const path = request?.originalUrl ?? request?.url ?? '';
    if (isUnthrottledPath(path)) return true;

    return super.shouldSkip(context);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return resolveClientIp(req, trustedProxyHops()) || 'unknown-origin';
  }
}
