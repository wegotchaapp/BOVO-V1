# Bovogo — Texas Intercity Carpooling MVP

Cost-sharing carpooling platform (not a TNC). Voyagers (drivers) recover actual travel costs only (IRS $0.67/mile). Sailors (riders) pay cost share + platform service fee. Each shared journey is called an Adventure.

**Brand vocabulary (UI only — code identifiers like `driverId`, `tripId` are unchanged):**
- App name: Bovogo (was SafeRide/WeGotcha)
- Driver → Voyager
- Rider → Sailor
- Trip / Ride → Adventure

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — Expo dev server (port 18115, Expo domain router)
- `pnpm --filter @workspace/api-server run dev` — API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/Zod from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- **Monorepo**: pnpm workspaces, Node.js 24, TypeScript 5.9
- **Mobile**: Expo SDK 54, React Native, expo-router v6 (file-based routing)
- **API**: Express 5, PostgreSQL + Drizzle ORM, Zod v4
- **Fonts**: Inter (400/500/600/700) via expo-google-fonts
- **Maps**: react-native-maps@1.20.1 (PROVIDER_DEFAULT = Apple Maps in Expo Go)
- **Payments**: @stripe/stripe-react-native@0.50.3 (mock; full setup documented below)
- **Build**: esbuild CJS bundle

## Design System

- **Palette**: Primary `#1B3D2F` (forest green), Background `#F8F7F3` (warm ivory), Accent `#C4954A` (amber gold)
- **Cards**: CARD_SHADOW / STRONG_SHADOW, no borders — `constants/colors.ts`
- **Buttons**: Pill CTAs (borderRadius 28), rounded secondary (borderRadius 16)
- **Typography**: Inter, letterSpacing -0.5 on headings

## Where Things Live

- `artifacts/mobile/app/` — all screens (expo-router file-based)
- `artifacts/mobile/app/(tabs)/` — tab screens: index (Home), trips, messages, profile
- `artifacts/mobile/data/trips.ts` — MOCK_TRIPS, TEXAS_CITIES, RECENT_SEARCHES
- `artifacts/mobile/data/posts.ts` — MOCK_POSTS (driver trip announcements)
- `artifacts/mobile/data/messages.ts` — MOCK_CONVERSATIONS
- `artifacts/mobile/constants/colors.ts` — design tokens + CARD_SHADOW/STRONG_SHADOW
- `artifacts/mobile/context/AuthContext.tsx` — auth + role state
- `artifacts/mobile/metro.config.js` — blockList fix for react-native-maps_tmp_*

## All Screens

| Screen | Path |
|---|---|
| Landing | `app/index.tsx` |
| Login / Register | `app/login.tsx`, `app/register.tsx` |
| Verify Identity | `app/verify.tsx` |
| Onboarding (6-step) | `app/onboarding.tsx` |
| Home (search + posts) | `app/(tabs)/index.tsx` |
| Search Results | `app/search-results.tsx` |
| Trip Details | `app/trip/[id].tsx` |
| Preferences (10Q) | `app/preferences.tsx` |
| Matching (animated) | `app/matching.tsx` |
| Payment (mock Stripe) | `app/payment.tsx` |
| Booking Confirmed | `app/booking-confirmed.tsx` |
| My Trips + Rate | `app/(tabs)/trips.tsx` |
| Rate Trip | `app/rate-trip/[id].tsx` |
| Messages | `app/(tabs)/messages.tsx` |
| Chat | `app/chat/[id].tsx` |
| Trip Tracking | `app/tracking/[id].tsx` |
| Safety Center (SOS hold) | `app/safety.tsx` |
| I Feel Unsafe | `app/safety-unsafe.tsx` |
| Profile | `app/(tabs)/profile.tsx` |
| Driver Posts Feed | `app/(tabs)/index.tsx` (section) |
| Post Detail + Reply | `app/post/[id].tsx` |
| Post a Trip (driver) | `app/post-trip.tsx` |
| Vehicle Registration | `app/vehicle.tsx` |
| Earnings Dashboard | `app/earnings.tsx` |

## Real Auth (Users)

Replaced the on-device placeholder with real backend auth.

- **DB tables**: `users` (id, name, email unique, phone, password_hash, role nullable, rating, trips, is_verified, onboarded, created_at), `user_sessions` (token id, user_id, expires_at). Schemas in `lib/db/src/schema/users.ts` + `user-sessions.ts`.
- **Endpoints** (`/api/auth/*`): `POST /register`, `POST /login`, `POST /logout`, `GET /me`, `PATCH /me`. Source: `artifacts/api-server/src/routes/auth/index.ts`. Password hashing via scrypt (`lib/password.ts`). Sessions are 30-day Bearer tokens (mobile) rather than cookies — see `lib/user-session.ts`.
- **Mobile**: `AuthContext` now calls the API and persists the bearer token in AsyncStorage (`@wegotcha/auth_token`). On boot, calls `/auth/me` to restore session. `lib/api.ts` is a small fetch wrapper that resolves base URL from `EXPO_PUBLIC_API_URL` → `EXPO_PUBLIC_DOMAIN` → relative.
- **Password rule**: 8+ chars (enforced both client and server via OpenAPI zod).
- **CCPA grace deletion**: still 7-day local grace; clears token on grace expiry. Server-side purge job is a follow-up.

## Real Earnings (Drivers)

Replaced the hardcoded $105.93 / 4-fake-trips dashboard with real DB-backed earnings.

- **DB table**: `driver_trips` (id, driverId, fromCity, toCity, miles, seatsBooked, grossAmount, platformFee, netAmount, completedAt). Numeric columns are decimal strings; coerce with `Number(...)` when reading. Schema: `lib/db/src/schema/driver-trips.ts`.
- **Endpoint**: `GET /api/earnings?period=month|all` (auth required via `requireUser`). Aggregates totals and returns trip list newest-first. Source: `artifacts/api-server/src/routes/earnings/index.ts`. Validated through generated `GetEarningsResponse` zod.
- **Mobile**: `app/earnings.tsx` now fetches via `apiClient`, supports period toggle (This Month / All Time), pull-to-refresh, loading/error/empty states. Empty state explains the cost-recovery model and links to Post a Trip.
- **Population**: Rows will be inserted when the booking + trip-completion pipeline is wired to real backend (currently mock). Until then, new users correctly see $0.00 / 0 trips instead of fabricated savings.

## Architecture Decisions

- **Expo domain router** (`router = "expo-domain"` in artifact.toml) — preview is at `$REPLIT_EXPO_DEV_DOMAIN`, not the proxy path. White screen in screenshot tool is expected.
- **Platform split for maps**: `TrackingMap.native.tsx` (real MapView + live GPS markers) + `TrackingMap.tsx` (web/Expo Go animated fallback) — avoids native codegen crash on web.
- **Live tracking architecture**: `useLiveLocation` hook (expo-location, foreground GPS, 10m/3s intervals) provides rider's real GPS. `useDriverSimulation` animates driver along route every 4s (replace with WebSocket/Supabase subscription in production). Both feed into TrackingMap.
- **Mapbox token stored**: `EXPO_PUBLIC_MAPBOX_TOKEN` in shared env. Ready to swap `TrackingMap.native.tsx` to `@rnmapbox/maps` when EAS Build is set up (Mapbox GL requires native build — not compatible with Expo Go).
- **Cost-sharing model**: Prices use updated formula `(miles × $0.67 × 0.75) ÷ seats` ($0.5025/mile effective). No profit language. Service fee labeled separately. Constants in `artifacts/mobile/lib/pricing.ts` (`IRS_RATE_PER_MILE`, `BOVOGO_RATE_FACTOR`).
- **Mock data only**: All trips, posts, messages are mock. No backend calls wired.
- **SOS**: 3-second hold with animated progress bar → 10-second countdown modal → dispatch alert. "I Feel Unsafe" is a separate screen with 4 discreet options + safe word.

## Founding Members (first 10,000 users)

- DB column: `users.is_founding_member` (boolean, default false).
- Auto-granted on `POST /api/auth/register` when the user-count check returns `< 10000`. Logic in `artifacts/api-server/src/routes/auth/index.ts` (`FOUNDING_MEMBER_LIMIT = 10_000`).
- Exposed on `AuthUser` DTO as `isFoundingMember`. Mobile `AuthContext.User` carries it through.
- UI: profile shows "Founding Member" badge and a gold crown overlay on the avatar (`crownOverlay` style in `app/(tabs)/profile.tsx`).
- Premium subscription ($22/mo with 1-year free trial for founding members) is deferred — Stripe wiring is a follow-up session.

## Regulatory Compliance

- Not a TNC — exempt from Texas Occupations Code Ch. 2401+
- CCPA (Privacy) — data export/deletion stubs in profile
- Texas BUIA (Biometric Consent) — ID verification is placeholder
- IRS 1099-K — earnings dashboard shows $600 threshold note
- Drivers cannot charge above IRS mileage rate ($0.67/mile)

## DB Backups (App Storage)

Nightly-ready DR snapshots. Bucket auto-provisioned via App Storage (`PRIVATE_OBJECT_DIR` is set).

- Script: `scripts/src/db-backup.ts`. Runs `pg_dump --no-owner --no-privileges` against `DATABASE_URL`, streams through gzip, uploads to `<PRIVATE_OBJECT_DIR>/backups/db/bovogo-db-<iso-ts>.sql.gz`.
- Commands (from repo root):
  - `pnpm --filter @workspace/scripts run db-backup` — take a fresh snapshot + rotate old ones
  - `pnpm --filter @workspace/scripts exec tsx ./src/db-backup.ts list` — list existing backups
  - `pnpm --filter @workspace/scripts exec tsx ./src/db-backup.ts rotate` — only run retention sweep
- Retention: `BACKUP_RETENTION_DAYS` env var (default 30). Anything older is deleted on each run.
- Restore: `gsutil cp` or App Storage UI to download a `.sql.gz`, then `gunzip -c file.sql.gz | psql "$DATABASE_URL"`.
- Scheduling: run this script on a Replit Scheduled Deployment (cron, e.g. nightly at 03:00 UTC) — not wired up yet, that's a publish-time step. The script itself is idempotent and safe to run on-demand.

## Stripe Premium Subscriptions ($22/mo)

Real Stripe subscription flow wired up. Founding members (first 10,000 users) get a **1-year free trial**; everyone else pays $22/mo immediately.

- **Connection**: Replit Stripe connector (no manual `STRIPE_SECRET_KEY` env var). Credentials fetched per-request via `getUncachableStripeClient()` in `artifacts/api-server/src/lib/stripeClient.ts`. API version pinned to `2025-08-27.basil` to match `stripe-replit-sync`.
- **Sync**: `stripe-replit-sync@1.0.0` mirrors Stripe data into the `stripe.*` Postgres schema. `runMigrations` + `findOrCreateManagedWebhook` + `syncBackfill` are called once at server boot from `artifacts/api-server/src/lib/initStripe.ts` (errors are logged but never crash the server). The package is **kept external in `build.mjs`** because it resolves SQL migration files at runtime relative to its package dir.
- **Webhook**: `POST /api/stripe/webhook` is mounted **before** `express.json()` (raw body required for signature verification). The managed webhook is auto-registered against `https://<REPLIT_DOMAINS[0]>/api/stripe/webhook`.
- **DB**: `users` gained `stripe_customer_id` + `stripe_subscription_id` (both nullable text). Schema in `lib/db/src/schema/users.ts`.
- **Endpoints** (`/api/subscriptions/*`, auth required):
  - `POST /start` — Idempotent (409 if user already has a subscription). Creates Stripe customer if needed, then `subscriptions.create` with `payment_behavior: "default_incomplete"`, `trial_period_days: 365` for founding members (omitted otherwise), expanded `latest_invoice.payment_intent` + `pending_setup_intent`. Returns `{ subscriptionId, status, clientSecret, publishableKey, trialEndsAt? }`.
  - `GET /me` — Returns `{ hasSubscription, status?, currentPeriodEnd?, trialEndsAt?, cancelAtPeriodEnd }`. Source: `artifacts/api-server/src/routes/subscriptions/index.ts`.
- **Snapshot resolution**: `services/subscriptions.ts > getSubscriptionSnapshot()` reads from local `stripe.subscriptions` first, **falls back to a direct Stripe API read** if the webhook hasn't synced yet (so `/auth/me` is correct immediately after subscribing).
- **AuthUser DTO**: now includes `subscriptionStatus` (enum or null) + `trialEndsAt` (ISO date or null). All four `userToDto` call-sites in `auth/index.ts` are async and `await`ed.
- **Product seed**: `pnpm --filter @workspace/scripts run seed-stripe` creates "Bovogo Premium" product + `$22/mo` USD recurring price. Idempotent — skips if already exists.
- **Mobile**:
  - `app/subscribe.tsx` — Modal subscribe screen wrapped in `<StripeProvider>`. Calls `POST /subscriptions/start`, opens Stripe Payment Sheet with the returned `clientSecret` (handles both SetupIntent for trial and PaymentIntent for immediate charge), then calls `refreshMe()` from AuthContext.
  - `AuthContext` exposes new `refreshMe()` action and carries `subscriptionStatus` + `trialEndsAt` on the `User` type.
  - Profile "Travel+" card is wired to navigate to `/subscribe`; price updated to $22/mo; CTA copy adapts to founding-member status and current subscription state.
  - **Important**: `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` should be set for native Stripe SDK initialization. The server-returned `publishableKey` is the source of truth; the env var is only for static `StripeProvider` setup.
- **OpenAPI**: `subscriptions` tag + `/subscriptions/start` + `/subscriptions/me` in `lib/api-spec/openapi.yaml`. Generated zod names: `StartSubscriptionBody`, `StartSubscriptionResponse`, `GetMySubscriptionResponse`.
- **Gotcha**: orval's zod generator for `oneOf: [date-time, null]` runs `zod.coerce.date()` on the union, which turns null into `new Date(0)`. The route handlers omit the field entirely when null instead of passing `null` to keep responses clean.

## Driver Cancel Adventure

- **Endpoint**: `DELETE /api/trips/:id` (auth required). Source: `artifacts/api-server/src/routes/trips/index.ts`. Only the trip's owner (driver) may cancel. Flips `status` to `cancelled` rather than hard-deleting so reply/booking history is preserved. Already-cancelled trips return `{ ok: true }` idempotently.
- **Mobile**: `deleteTrip(id)` in `lib/trips.ts`. UI: red "Cancel" chip on driver-owned upcoming rows in `(tabs)/trips.tsx`, gated on `role === "driver"` and `status === "upcoming"`. Uses an optimistic update with rollback on failure.
- Cancelled trips disappear from search results (`/trips` filters by `status = active`) and from the driver's "Upcoming" tab. They still show in "Past" with the existing Cancelled badge.

## Gotchas

- **Stripe RN on web**: `@stripe/stripe-react-native` is native-only (imports `react-native/Libraries/Utilities/codegenNativeCommands`) and breaks Metro's **web** bundle. Don't import it directly in any route or shared file. Use the platform-split wrappers in `lib/stripeNative.ts` (re-exports real SDK) + `lib/stripeNative.web.ts` (no-op stubs). `app/subscribe.tsx` imports `{ StripeProvider, useStripe } from "@/lib/stripeNative"`. Note: route-level `.web.tsx` / `.native.tsx` extensions did NOT prevent the broken file from being picked up by expo-router's `require.context` for web — only the `lib/` platform extensions worked.
- Metro blockList in `metro.config.js` prevents ENOENT errors from react-native-maps pnpm post-install dirs
- Do not run `pnpm dev` at workspace root — use `restart_workflow` or let workflows handle it
- `colors.success` = `#1A7A4A` (close to primary, use for positive states)
- Onboarding 6-step wizard: step 4 (emergency contact) requires name + phone (10+ digits) to advance
- **Never declare components inside other components.** Doing so creates a new component identity on every render, which causes any focused `TextInput` inside to unmount/remount on each keystroke (loses focus after 1 char). The reusable `Field` wrapper in `app/post-trip.tsx` is declared at module scope for this reason.

## SafeRide Support (admin web app)

Standalone web admin at `artifacts/support-admin` (slug `support-admin`, served at `/support-admin/`). Backend lives in `artifacts/api-server` under `/api/support/*` (auth, agents, tickets, dashboard). Uses cookie sessions (`saferide_support_session`) stored in `support_sessions` table; CORS is `credentials: true`.

- Schema: `support_agents`, `support_tickets`, `support_ticket_messages`, `support_sessions` in `lib/db/src/schema/`.
- Seed: `pnpm --filter @workspace/api-server run seed` — creates 3 agents and 10 demo tickets. Idempotent (skips if any agent rows exist).
- Demo logins (all password `support123`): `maya@saferide.support` (admin), `jordan@saferide.support`, `riley@saferide.support`. Login page has one-click demo buttons.
- Pages: Login, Dashboard (counts/SLA), Inbox (filter+search), Ticket Detail (reply public/internal, change status/priority/assignee), Agents (list/create).
- Mobile app is untouched.

## Texas Cities (MVP)

Dallas, Austin, Houston, San Antonio, Fort Worth, El Paso, Arlington, Plano, Lubbock, Corpus Christi, Waco, Amarillo
