# Security wave 1 — production config plumbing (2026-09-23)

Bounded finish pass on the wave-1 security files, plus two correction passes
over this report's own claims (§4, and "Checkr and Noonlight" — which was
itself corrected a second time; see that section). No commits, no pushes, no
deploys, no installs, no provider calls, and no real `.env` written. Nothing
outside the wave-1 file set was touched — in particular the settlement work
(services, entities, migrations) and the mobile UI are untouched.

The one behavioural change in the latest pass is the Noonlight webhook failing
closed in all environments. The Checkr finding from the previous pass is
**withdrawn as incorrect** and no Checkr code was changed.

## Verification actually run

Re-run after the Noonlight fix and the Checkr retraction below, from `backend/`:

| Command | Result |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit` | clean, no output |
| `node node_modules/jest/bin/jest.js --runInBand src/modules/safety` | **2 suites / 83 tests passed**, 0 failed |
| `node node_modules/jest/bin/jest.js --runInBand src/modules/payments src/common src/modules/safety src/modules/identity` | **12 suites / 214 tests passed**, 0 failed |

`noonlight-webhook.controller.spec.ts` went from 13 to 41 cases.
`deploy-env.spec.ts` went from 10 to 25. Codex's focused webhook/throttler
tests are preserved and still pass; nothing in them was rewritten.

Two pre-existing Noonlight cases were **replaced, not merely added to**, because
the behaviour they asserted is the bug: "fails closed in production when no
secret is configured" (right conclusion, wrong scope and wrong status code) and
"allows unsigned traffic outside production so sandbox bring-up can start"
(asserted the bypass as a feature).

This is a subset run, not the whole backend suite. The root's 22-suite /
289-test security-isolated figure was recorded before this patch and against a
different file selection, so it is not directly comparable to the numbers
above; nothing outside the paths listed here was executed.

## What changed

### 1. Production variable plumbing

`TRUST_PROXY_HOPS` and `TWILIO_WEBHOOK_BASE_URL` existed in code but were
plumbed nowhere — not in the template, not in the deploy writer, not in the
workflow. Both now run end to end, along with the provider secret **names**
(never values) the code actually reads.

Names were taken from the source, not assumed. Confirmed readers:

| Variable | Read by |
| --- | --- |
| `TRUST_PROXY_HOPS` | `common/http/trusted-proxy.ts` (throws at boot in production) |
| `TWILIO_WEBHOOK_BASE_URL` | `common/guards/twilio-signature.guard.ts` |
| `STRIPE_WEBHOOK_SECRET` | `payments.controller.ts` |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | `stripe-connect-webhook.controller.ts`, `stripe-connect.service.ts` |
| `STRIPE_IDENTITY_WEBHOOK_SECRET` | `identity/identity.service.ts` |
| `STRIPE_PRICE_ID`, `STRIPE_PUBLISHABLE_KEY` | `mobile-subscriptions.service.ts`, `payments.controller.ts` |
| `CHECKR_API_KEY`, `CHECKR_WEBHOOK_SECRET`, `CHECKR_API_URL` | `checkr.service.ts`, `checkr-webhook.controller.ts`, `mobile-background-check.service.ts` |
| `NOONLIGHT_API_KEY`, `NOONLIGHT_API_URL`, `NOONLIGHT_WEBHOOK_SECRET` | `noonlight.service.ts`, `noonlight-webhook.controller.ts` |

- **`backend/.env.example`** (template only, placeholders only): added
  `TRUST_PROXY_HOPS`, `TWILIO_WEBHOOK_BASE_URL`,
  `STRIPE_CONNECT_WEBHOOK_SECRET`, `NOONLIGHT_WEBHOOK_SECRET`,
  `CHECKR_API_URL`, and commented-out optionals (`TWILIO_PROXY_NUMBER`,
  `CHECKR_PACKAGE`, `CHECKR_TIMEOUT_MS`, `NOONLIGHT_TIMEOUT_MS`). The three
  Stripe endpoint secrets are now grouped with the endpoint each one belongs
  to, so reusing one value across all three is visibly wrong.
- **`backend/scripts/write-deploy-env.cjs`**: managed-key list extended to the
  full inventory above.
- **`.github/workflows/backend-deploy.yml`**: matching `env:` entries, plus two
  preflight gates (below).

### 2. `TRUST_PROXY_HOPS` — operator requirement, not a default

`trustedProxyHops()` throws in production when the value is unset. That is
deliberate and was **left as is**: any default is wrong in a way that matters.
Too high trusts a caller-supplied `X-Forwarded-For` entry; too low collapses
every client behind the edge into one rate-limit bucket and locks the platform
out of `/auth/login` as soon as one caller is noisy. **The hop count was not
invented here** — it is a fact about the deployment topology.

So the deploy now fails *before* Railway cuts traffic over, rather than
shipping a crash-looping container: a `Require a counted reverse-proxy depth`
step errors with an actionable message when `vars.TRUST_PROXY_HOPS` is unset or
non-numeric. A sibling step requires `TWILIO_WEBHOOK_BASE_URL` and requires it
to be an `https://` origin.

**Operator action required before the next production deploy** (neither can be
derived from the repo):

1. Count the reverse proxies in front of the backend service and set the
   repository **variable** `TRUST_PROXY_HOPS` — `1` for a single Railway or
   Cloudflare edge, `2` when both are in the path. It is a variable rather than
   a secret because it is not sensitive and should be visible in the run log.
2. Set the **secret** `TWILIO_WEBHOOK_BASE_URL` to the public https origin
   Twilio posts to (scheme + host, no trailing path). It must match the webhook
   URLs configured in the Twilio console character for character — the guard
   rebuilds the signed URL from this value rather than from `Host` /
   `X-Forwarded-Host`, which a caller controls.
3. Set `STRIPE_CONNECT_WEBHOOK_SECRET` and `STRIPE_IDENTITY_WEBHOOK_SECRET` as
   **distinct** values copied from their own Stripe endpoints. Aliasing them to
   `STRIPE_WEBHOOK_SECRET` silently defeats the per-endpoint check.

### 3. Defects found and fixed

- **`write-deploy-env.cjs` wrote blank secrets over template placeholders.** A
  GitHub `env:` mapping of an unset secret is the empty string, not an absent
  variable, so `Object.hasOwn` was true and the script emitted `KEY=""`. An
  operator who forgot one secret got a green deploy and a production 500 on
  every signed webhook — or, for `TRUST_PROXY_HOPS`, a container that refused
  to boot. A `requiredKeys` subset now fails the deploy with the offending
  names. Checkr and Noonlight keys are deliberately *not* in that subset while
  those integrations are still being provisioned — see "Checkr and Noonlight"
  below for what that actually costs.
- **`isUnthrottledPath` matched on a bare string prefix.** `startsWith('/health')`
  also exempted `/healthz-flood`, and `startsWith('/payments/webhook')` exempted
  `/payments/webhook-probe`. No route serves those, but an unthrottled 404 is
  still an unthrottled request an anonymous caller picks freely. Matching now
  ends at a segment boundary (`=== base || startsWith(base + '/')`). All
  previously-asserted paths classify identically.

### 4. Correction pass — what the first version got wrong

**`requiredKeys` only caught a key that was present and empty.** A key the
workflow never maps at all is *absent*, not blank, so `Object.hasOwn` was false
and the writer skipped it silently, leaving the `.env.example` placeholder in
the shipped file. That is the quieter half of the same bug the check was
written for: production would have run on
`whsec_your-platform-webhook-secret`. The writer now derives an explicit
production mode and, in that mode, rejects a required key that is **absent or
blank**. Blank stays rejected everywhere, because writing `KEY=""` over a
placeholder is destructive regardless of environment; absence is tolerated
outside production so local `.env` bootstrapping and the tests can still write
one key at a time.

Production mode is `NODE_ENV === 'production' || APP_ENV === 'production'`,
read from the **incoming CI environment** — the same rule as
`isProductionEnvironment` in `common/http/cors.config.ts`. It deliberately does
not read the file being written: `.env.example` ships `APP_ENV=development` and
should, so the template can never be what decides how strictly it is checked.
The `Load production .env` step already sets `APP_ENV: production`, which is
what now arms the check.

**The Twilio origin was checked with a `https://*` glob.** That accepts
`https://api.bovogo.app/hooks`, `https://api.bovogo.app?x=1` and
`https://user:pass@api.bovogo.app`. `canonicalWebhookUrl` concatenates the
value with the request path, so each of those rebuilds a URL Twilio never
signed and fails every genuine callback. The writer now parses it with `new
URL` and requires scheme + host only — no path, query, fragment, userinfo or
surrounding whitespace, and https in production. A trailing slash is accepted
because the guard strips one. The error messages name the key and never quote
the value, since deploy logs are public. The workflow's preflight step is now
presence-only, with the shape check living in the one place that has a URL
parser.

**The `.env.example` Stripe comment documented a no-charge booking as normal.**
It read "Without real keys, booking falls back to instant confirm (no charge)."
That was true when written and is no longer: `create()` was retired in the
product lane while this pass was open. The comment now states the current
behaviour — prepare/confirm answer "Payments are not configured" without a
usable key, and the legacy `POST /api/bookings` path always rejects — rather
than describing the old fallback as a supported mode.

**The Twilio guard's doc comment described an attack that cannot happen.** It
claimed a host-spoofing caller would "sign their own payload" and pass the
check. Nobody can mint a Twilio signature without `TWILIO_AUTH_TOKEN`. The
conclusion was right and the reasoning was not: the real risk is **replay**.
One auth token covers every origin a Twilio account points at — staging, a
preview deploy, a dev tunnel — so a request genuinely signed for one of those
can be replayed here by setting `X-Forwarded-Host` to the origin it was signed
for, and a server that rebuilds the URL from that header validates it. Pinning
the origin to configuration removes the half of the comparison the caller
supplied. Comment-only change; the guard's logic was already correct.

### 5. Tests added

- **`src/modules/payments/subscription-confirm.spec.ts`** (new) — the caller
  chooses the PaymentIntent id, so every property that makes it evidence of
  *this user's* Travel+ purchase is asserted: ownership (another account's
  intent → 403; an intent with no `user_id` → 403), product
  (`metadata.type` of a booking charge, or no metadata at all), status
  (`requires_payment_method`, `requires_capture`), amount (underpayment, and a
  full-price intent that only partially captured — `amount_received` is what is
  checked), currency (`mxn` at the same numeric amount), and age. Plus the
  **mocked-key bypass removal**: `sk_test_local_mock`, `sk_test_mock` and
  `sk_live_mock_placeholder` with an empty body all reject, and a mock-looking
  key still performs full verification. Creation-side tests assert the intent is
  stamped with the metadata `confirm` later checks, and that a Stripe failure
  surfaces instead of returning a pretend intent.
- **`src/common/config/deploy-env.spec.ts`** (new, 25 cases) — runs the real
  `.cjs` script as a child process against temp files: substitution, unmanaged
  keys left alone, newline/quote/delimiter injection contained to one physical
  line, failure on a managed key missing from the template, failure on each
  blank required secret (with the file left unmodified), and a drift check that
  every managed key is declared in `.env.example`. The correction pass added
  production mode (a required key absent under `APP_ENV=production` and under
  `NODE_ENV=production`; blank under production; the whole set present writes;
  a partial write still succeeds outside production) and the Twilio origin
  shape (path, query, fragment, userinfo, whitespace, non-URL and plain http
  all rejected — asserting the message does not echo the value — while a bare
  origin with or without a trailing slash, and the template's
  `http://localhost:3000` outside production, are accepted). Both key lists are
  read out of the script's source, so a name added to `requiredKeys` is covered
  without editing the spec. **No real `.env` is touched**: every case writes to
  a fresh `mkdtemp` directory and the child process receives only `PATH` plus
  the case's explicit variables.
- **`app-throttler.guard.spec.ts`** — four boundary cases for the prefix fix.

## Checkr and Noonlight

An earlier draft of this report asserted both endpoints "fail closed on their
own" while also saying they had not been reviewed. Both controllers were then
read, and that correction pass got the Checkr half wrong in the other
direction. Both entries below supersede everything said about these two
endpoints above. Noonlight is now fixed; Checkr needs no code change.

### Noonlight — was a real bypass, now fixed

`noonlight-webhook.controller.ts` gated the blank-secret rejection on
`NODE_ENV === 'production'` alone. With `NOONLIGHT_WEBHOOK_SECRET` unset and
`NODE_ENV` anything else, the endpoint logged a warning and processed the
request with no signature check at all — and it mutates the state of a live
emergency, unauthenticated. The repository Dockerfile explicitly sets `NODE_ENV=production`, so that
container path already engaged the production guard. Other execution paths
without that value could process unsigned updates. The fix closes that
environment-dependent bypass; it is not evidence that Docker deployments
previously accepted unsigned requests.

**Fixed by failing closed everywhere rather than by widening the gate.** The
environment check is gone entirely, not replaced with the
`NODE_ENV || APP_ENV` rule the rest of the codebase uses: there is no
environment in which processing an unverified emergency update is wanted, so
there is nothing for an environment check to decide. `isProduction` is removed
from the controller.

The two failure modes now answer differently, which is the point of the change:

| Condition | Response | Why |
| --- | --- | --- |
| `NOONLIGHT_WEBHOOK_SECRET` absent or blank | **503** `ServiceUnavailableException` | Our misconfiguration; authenticity cannot be evaluated yet. 5xx is what Noonlight retries, so the alarm update survives instead of being acknowledged as handled when nothing handled it. Previously: processed unverified (non-prod) or 401 (prod) — a 401 is terminal, so even the production path discarded the event. |
| Signature header absent, or digest wrong | 401 `UnauthorizedException` | Unchanged. Nothing should retry that. |
| Raw body unavailable | 401 `UnauthorizedException` | Unchanged — already failed closed. Flagged below as arguably a 503 for the same reason as row 1. |

Signature verification itself was **not** touched: HMAC-SHA256 over the exact
bytes received, hex or base64 accepted, compared with `timingSafeEqual`, header
name overridable via `NOONLIGHT_WEBHOOK_SIGNATURE_HEADER`. That matches
Noonlight's published scheme
(<https://docs.noonlight.com/reference/webhook-authenticity>). The header name
and digest encoding are still unconfirmed **for this account** — no provider
call was made — so both encodings stay accepted and the header stays
overridable. Confirm both at provisioning and narrow if the provider is
stricter than assumed. The controller comment now says exactly this instead of
"unconfirmed against Noonlight's docs".

Cost of the fix: sandbox bring-up now needs `NOONLIGHT_WEBHOOK_SECRET` set
before the endpoint serves anything, including locally. Noonlight only issues
the real secret once a webhook URL is saved, so until then any non-empty string
both ends agree on works. `.env.example` now says so.

### Checkr — the API-key fallback is correct; the previous finding was wrong

The correction pass claimed `checkr-webhook.controller.ts:35`
(`CHECKR_WEBHOOK_SECRET || CHECKR_API_KEY || ''`) verified against "a value
Checkr never signs with", and prescribed dropping the fallback. **That claim was
wrong and the prescription would have broken a working endpoint.** It is
withdrawn.

Per Checkr's current documentation
(<https://docs.checkr.com/#section/Webhooks/Securing-webhooks>), an ordinary
Checkr API integration's webhook signing key **is** its API key; the OAuth
client secret is the signing key for Partner applications
(<https://docs.checkr.com/partners/>). This integration is the ordinary kind —
`checkr.service.ts:335` and `:376` authenticate with HTTP Basic using
`CHECKR_API_KEY` as the username, which is the non-partner scheme. So falling
back to `CHECKR_API_KEY` when `CHECKR_WEBHOOK_SECRET` is blank is the correct
default for this integration, and removing it would have made every genuine
callback 401 — the exact failure the finding claimed to prevent.

**No Checkr code change was made, and none is needed for this.** What remains
true from the original reading: the endpoint does fail closed
(`checkr-webhook.controller.ts:100` rejects on missing secret, raw body or
signature header), and it reads `process.env` directly at construction rather
than through `ConfigService` — a consistency wart, not a security defect, and
left alone.

Which key actually signs this account's webhooks is an account fact, not a
repository fact, and **no provider call was made to establish it**. It has to be
read off the Checkr dashboard when the integration is provisioned. Both
`.env.example` entries now state the rule and say to confirm it then; the
`CHECKR_WEBHOOK_SECRET` line now explains that it is only needed if this
account signs with something other than the API key.

## Not done — still open

- `mobile-background-check.service.ts` and `identity-webhook.controller.ts`
  were not opened at all. **This pass does not claim all webhook endpoints are
  fixed** — the verified ones are `/payments/webhook`,
  `/webhooks/stripe-connect`, the Twilio opt-out callback, and now
  `/safety/noonlight/webhook`.
- **`NOONLIGHT_WEBHOOK_SECRET` should move into the deploy writer's
  `requiredKeys`** now that a blank value takes the endpoint out of service
  everywhere. It is deliberately still outside that set, because adding it
  fails every deploy until the secret exists in GitHub — and the endpoint
  already announces its own absence with a retryable 503 rather than a silent
  bypass, which is the behaviour that actually mattered. Add it the moment
  Noonlight issues the value.
- `CHECKR_WEBHOOK_SECRET` is plumbed and not required, which is now correct on
  purpose rather than provisionally: blank means "this account signs with the
  API key", the documented default for a non-partner integration.
- The Noonlight endpoint answers 401, not 503, when `req.rawBody` is missing.
  That is a middleware-registration fault on our side, so by the same argument
  as the missing-secret case it arguably deserves a retryable 5xx. Left alone —
  it already fails closed, and changing it was outside this pass.
- `payments.controller.ts` constructs `new Stripe(STRIPE_SECRET_KEY!)` in its
  constructor, so an instance with no key fails at module init rather than
  falling back to `createStripeWebhookClient` the way the Connect controller
  does. Not changed — it is a boot-time behaviour question, not a signature
  defect, and changing it was outside this pass.
- ~~The legacy `POST /api/bookings` path still confirms a seat without charging
  when no Stripe key is configured.~~ **Closed elsewhere, not by this pass.**
  `mobile-bookings.service.ts:169` is now `async create(): Promise<never>` and
  always throws — `requireStripe()` first, so an unconfigured instance answers
  "Payments are not configured", otherwise a `BadRequestException` pointing at
  prepare/confirm. Verified by reading the service, not inferred from the other
  agent's summary. `.env.example` is updated to match.

## Dependency manifest for a selective commit

These files form one coherent change and should be committed together —
splitting them breaks the deploy (the writer throws when a managed key is
absent from the template, and `deploy-env.spec.ts` asserts exactly that):

```
.github/workflows/backend-deploy.yml
backend/.env.example
backend/scripts/write-deploy-env.cjs
backend/src/common/config/deploy-env.spec.ts          (new)
```

Independent, committable on its own:

```
backend/src/common/guards/app-throttler.guard.ts      (prefix boundary fix)
backend/src/common/guards/app-throttler.guard.spec.ts (its four new cases)
```

Independent, committable on its own:

```
backend/src/modules/payments/subscription-confirm.spec.ts   (new)
```

Independent, committable on its own — the Noonlight fail-closed fix:

```
backend/src/modules/safety/noonlight-webhook.controller.ts
backend/src/modules/safety/noonlight-webhook.controller.spec.ts
```

The `.env.example` Noonlight comment belongs with it, but that file is in the
deploy group above; if the two are split, the operator note about the secret
being required everywhere travels with the template, not the controller.

Independent, committable on its own — **comment only, no logic change**:

```
backend/src/common/guards/twilio-signature.guard.ts   (replaces the wrong
                                                       host-spoof explanation)
backend/src/app.module.ts                             (throttler comment
                                                       pointed at a
                                                       SECURITY_WAVE1 file
                                                       dated 09-22 that does
                                                       not exist; now 09-23)
```

Already-present wave-1 files this pass did **not** modify, but which the new
tests import and which must already be in the tree: `payments.controller.ts`,
`stripe-connect-webhook.controller.ts`, `twilio-webhook.controller.ts`,
`common/http/{stripe-webhook.verifier,trusted-proxy,webhook-body-parsers}.ts`,
`main.ts`. (`app.module.ts` was previously in this list; it now carries a
one-word comment fix and is listed above instead.)

Untracked wave-1 files still needing `git add` if this is committed:
`app-throttler.guard.{ts,spec.ts}`, `twilio-signature.guard.ts`,
`stripe-webhook.verifier.ts`, `trusted-proxy.ts`, `webhook-body-parsers.ts`,
`webhook-verification.spec.ts`. **Do not `git add -A`** — the tree also holds
another agent's settlement work and mobile UI changes.
