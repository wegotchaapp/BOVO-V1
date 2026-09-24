type Environment = Record<string, string | undefined>;

type HeaderBag = Record<string, string | string[] | undefined>;

export interface AddressableRequest {
  headers?: HeaderBag;
  socket?: { remoteAddress?: string | null };
  connection?: { remoteAddress?: string | null };
  ip?: string;
}

/**
 * Number of reverse proxies Bovogo actually operates in front of the API.
 *
 * `X-Forwarded-For` is appended to by every hop, including the client, so the
 * only entries that cannot be forged are the right-most `TRUST_PROXY_HOPS`
 * ones. Anything further left was supplied by the caller and must never be
 * used for a security decision such as rate-limit bucketing.
 */
export const TRUST_PROXY_HOPS_VAR = 'TRUST_PROXY_HOPS';

function isProduction(env: Environment): boolean {
  return env.NODE_ENV === 'production' || env.APP_ENV === 'production';
}

/**
 * Resolves the configured proxy depth.
 *
 * Unset is treated as "no proxy" (trust nothing) outside production. In
 * production an unset value is fatal: with 0 hops every request behind the
 * edge proxy collapses into a single rate-limit bucket, which locks the whole
 * platform out of `/auth/login` the moment one client is noisy. Guessing a
 * value instead would mean trusting a spoofable header. Same fail-fast shape
 * as `createCorsOptions`.
 */
export function trustedProxyHops(env: Environment = process.env): number {
  const raw = env[TRUST_PROXY_HOPS_VAR];

  if (raw === undefined || raw.trim() === '') {
    if (isProduction(env)) {
      throw new Error(
        `${TRUST_PROXY_HOPS_VAR} is required in production. Set it to the number of reverse proxies in front of this API (1 for a single Railway/Cloudflare edge). It decides which X-Forwarded-For entry is trusted for rate limiting.`,
      );
    }
    return 0;
  }

  const hops = Number(raw.trim());
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(
      `${TRUST_PROXY_HOPS_VAR} must be a non-negative integer, received "${raw}".`,
    );
  }

  return hops;
}

function normalize(address: string | null | undefined): string {
  if (!address) return '';
  const trimmed = address.trim();
  // Node reports IPv4 peers over a dual-stack socket as ::ffff:203.0.113.4.
  const unmapped = trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
  // A bare IPv4 address may carry a source port; IPv6 literals keep their colons.
  const colons = unmapped.split(':').length - 1;
  return colons === 1 ? unmapped.split(':')[0] : unmapped;
}

function forwardedChain(headers: HeaderBag | undefined): string[] {
  const header = headers?.['x-forwarded-for'];
  const joined = Array.isArray(header) ? header.join(',') : (header ?? '');
  return joined
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * The client address, derived with the same rule Express applies for a numeric
 * `trust proxy` setting: walk `hops` entries in from the right of the
 * forwarded chain.
 *
 * Falls back to the direct socket peer whenever the header cannot be trusted —
 * no header, a chain shorter than the configured depth (the request did not
 * traverse the proxies we expect), or `hops` of 0.
 */
export function resolveClientIp(
  req: AddressableRequest,
  hops: number,
): string {
  const direct = normalize(
    req.socket?.remoteAddress ?? req.connection?.remoteAddress ?? req.ip,
  );

  if (hops <= 0) return direct;

  const chain = forwardedChain(req.headers);
  if (chain.length < hops) return direct;

  return normalize(chain[chain.length - hops]) || direct;
}
