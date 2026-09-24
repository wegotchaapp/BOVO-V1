const fs = require('node:fs');
const path = require('node:path');

const envFile = path.resolve(process.argv[2] ?? '.env');

/**
 * Keys this script copies out of the CI environment into the deployed .env.
 *
 * A key absent from this list keeps its `.env.example` placeholder in
 * production — which for a webhook secret means the endpoint 500s on every
 * signed event, and for `TRUST_PROXY_HOPS` means the process refuses to boot.
 * The list is therefore the authoritative inventory of what the deploy
 * actually plumbs through; adding a var to the template is not enough.
 */
const managedKeys = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'APP_ENV',
  'APP_URL',
  'ALLOWED_ORIGINS',
  'LOG_LEVEL',
  // Decides which X-Forwarded-For entry is trusted for rate-limit bucketing.
  // `trustedProxyHops` throws in production when this is unset, so a deploy
  // that omits it produces a crash-looping container.
  'TRUST_PROXY_HOPS',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  // One secret per Stripe endpoint. Each receiver verifies against only its
  // own, so these are three distinct values and never aliases of each other.
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_CONNECT_WEBHOOK_SECRET',
  'STRIPE_IDENTITY_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'TWILIO_VERIFY_SERVICE_SID',
  // The public origin TwilioSignatureGuard rebuilds the signed URL from.
  'TWILIO_WEBHOOK_BASE_URL',
  'CHECKR_API_KEY',
  'CHECKR_WEBHOOK_SECRET',
  'CHECKR_API_URL',
  'NOONLIGHT_API_KEY',
  'NOONLIGHT_API_URL',
  'NOONLIGHT_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
];

/**
 * Managed keys a production deploy may not ship without.
 *
 * Deliberately not every managed key: Checkr and Noonlight are still being
 * provisioned, so their absence is allowed to reach a deploy. See
 * `workflow/SECURITY_WAVE1_2026-09-23.md` for what that actually costs —
 * Noonlight's own fail-closed check is narrower than this one.
 */
const requiredKeys = [
  'DATABASE_URL',
  'JWT_SECRET',
  'APP_ENV',
  'ALLOWED_ORIGINS',
  'TRUST_PROXY_HOPS',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_CONNECT_WEBHOOK_SECRET',
  'STRIPE_IDENTITY_WEBHOOK_SECRET',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_WEBHOOK_BASE_URL',
];

/**
 * Same rule as `isProductionEnvironment` in `common/http/cors.config.ts`, read
 * from the CI environment rather than the template: `.env.example` ships
 * `APP_ENV=development` and always will, so the file being written can never
 * be the thing that decides how strictly it is checked. The deploy workflow
 * sets `APP_ENV: production` on the step that runs this script.
 */
const isProduction =
  process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';

const blankKeys = requiredKeys.filter(
  (key) =>
    Object.hasOwn(process.env, key) && String(process.env[key]).trim() === '',
);

// A GitHub `env:` mapping of an unset secret is the empty string, not an
// absent variable, so this would otherwise write `KEY=""` over the template
// placeholder — destructive in any environment, not just production.
if (blankKeys.length > 0) {
  throw new Error(
    `These deployment secrets resolved to an empty value: ${blankKeys.join(
      ', ',
    )}. Set them in the repository's Actions secrets; writing them blank would ship a container that fails closed at boot or on the first signed webhook.`,
  );
}

// Absence is the quieter failure: an unmapped key leaves the `.env.example`
// placeholder in place, so the deploy goes green and production runs on
// `whsec_your-platform-webhook-secret`. Outside production a partial write is
// the intended use (local `.env` bootstrapping, the tests), so only production
// demands the full set.
if (isProduction) {
  const absentKeys = requiredKeys.filter(
    (key) => !Object.hasOwn(process.env, key),
  );

  if (absentKeys.length > 0) {
    throw new Error(
      `A production deploy is missing these deployment secrets entirely: ${absentKeys.join(
        ', ',
      )}. Each one is absent from the environment, so the template placeholder would ship in its place. Map them in the workflow's \`env:\` block and set them in the repository's Actions secrets.`,
    );
  }
}

/**
 * The origin TwilioSignatureGuard rebuilds the signed URL from.
 *
 * `canonicalWebhookUrl` concatenates this value with the request path, so the
 * value has to be an origin and nothing else. A prefix check on `https://`
 * accepts `https://api.bovogo.app/hooks`, `https://api.bovogo.app?x=1` and
 * `https://user:pass@api.bovogo.app` — each of which produces a URL that is
 * not the one Twilio signed, so every genuine callback fails verification.
 *
 * Errors never quote the value: it is deploy configuration in a public log.
 */
function assertCanonicalOrigin(key, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} is not a valid URL.`);
  }

  // http is allowed outside production only because the template's own default
  // is http://localhost:3000.
  const allowedProtocols = isProduction ? ['https:'] : ['https:', 'http:'];
  if (!allowedProtocols.includes(url.protocol)) {
    throw new Error(
      `${key} must be an https origin; Twilio signs the URL it posted to.`,
    );
  }

  if (url.username || url.password) {
    throw new Error(`${key} must not carry userinfo credentials.`);
  }

  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(
      `${key} must be scheme + host only, with no path, query or fragment — the guard appends the request path to it.`,
    );
  }

  // `new URL` tolerates surrounding whitespace; dotenv and the guard do not.
  if (value.trim() !== value) {
    throw new Error(`${key} must not be surrounded by whitespace.`);
  }
}

if (Object.hasOwn(process.env, 'TWILIO_WEBHOOK_BASE_URL')) {
  const value = String(process.env.TWILIO_WEBHOOK_BASE_URL);
  if (value.trim() !== '') {
    assertCanonicalOrigin('TWILIO_WEBHOOK_BASE_URL', value);
  }
}

const source = fs.readFileSync(envFile, 'utf8');
const foundKeys = new Set();
const output = source.replace(/^([A-Z][A-Z0-9_]*)=.*$/gm, (line, key) => {
  foundKeys.add(key);

  if (!managedKeys.includes(key) || !Object.hasOwn(process.env, key)) {
    return line;
  }

  // JSON string syntax is accepted by dotenv and safely represents delimiter,
  // quote, backslash, and newline characters without exposing their values.
  return `${key}=${JSON.stringify(process.env[key])}`;
});

const missingKeys = managedKeys.filter(
  (key) => Object.hasOwn(process.env, key) && !foundKeys.has(key),
);

if (missingKeys.length > 0) {
  throw new Error(
    `The deployment environment template is missing: ${missingKeys.join(', ')}`,
  );
}

fs.writeFileSync(envFile, output);
