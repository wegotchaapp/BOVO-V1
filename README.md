# Bovogo — Unified Monorepo

Bovogo is a Texas-focused intercity carpooling app. This repository unifies the
three pieces needed to build, run, and ship it:

```
BOVOGO/
├── mobile/    # Bovogo mobile app (Expo / React Native) — the App Store / Play app
│   └── artifacts/mobile/   ← the actual Expo app (pnpm workspace)
├── backend/   # NestJS + TypeORM API (source of truth)
├── admin/     # Admin dashboard (React + Vite)
└── docs/      # Launch docs, pricing spec, submission checklist
```

The **mobile app** is the Replit-built Bovogo client. The **backend** is the
NestJS platform. They are connected by an additive **mobile compatibility
layer** in the backend (`backend/src/modules/mobile-api`) that serves the exact
`/api/*` REST contract the mobile app expects — so neither the app's screens nor
the platform's existing modules had to change.

---

## Architecture of the integration

```
Expo app  ──fetch──►  https://api.bovogo.com/api/*  ──►  MobileApiModule (NestJS)
                                                          └─ mobile_* tables (isolated)
Admin app ──axios──►  https://api.bovogo.com/admin/*  ──►  (existing platform modules)
```

- **Auth model:** the mobile app uses a single long-lived (30-day) opaque Bearer
  token. `MobileApiModule` issues and validates these against the `mobile_sessions`
  table via `MobileAuthGuard`. (The platform's JWT+refresh auth is untouched.)
- **Data isolation:** all mobile data lives in dedicated `mobile_*` tables so the
  integration is purely additive and cannot collide with the platform's primary
  schema. See `backend/src/database/migrations/1746600000000-MobileApiTables.ts`.
- **Endpoints served** (all under `/api`): `auth` (`me`/`login`/`register`/
  `logout`), `trips` (+ `replies`, `mark-read`), `bookings`, `groups`,
  `earnings`, `subscriptions`, and `notifications/unread`.

---

## Quick start (local)

### 1. Backend (NestJS)

```bash
cd backend
cp .env.example .env            # fill in DATABASE_URL, JWT_SECRET, REDIS_URL, etc.
npm install
npm run db:migrate              # creates platform tables + mobile_* tables
npm run start:dev               # serves http://localhost:3000
```

Requirements: PostgreSQL 15+ and Redis. `DATABASE_URL` and `REDIS_URL` are the
only hard requirements to boot; third-party keys (Stripe, Twilio, Mapbox, etc.)
are optional and degrade gracefully.

> Subscriptions: set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and
> `STRIPE_PRICE_ID` to enable the premium flow. Without them, the subscribe
> screen surfaces a clean "Payments are not configured" message.

**Fresh local database:** on an empty Postgres database, set
`DATABASE_SYNCHRONIZE=true` in `backend/.env`, start the backend once (creates
all platform tables from entities), then set it back to `false`. Seed demo data:

```bash
cd backend
npm run db:seed    # admin@test.com / testpass123, plus drivers & trips
```

Login to the admin dashboard with `admin@test.com` / `testpass123`.

### 2. Mobile app (Expo)

```bash
cd mobile
npm install -g pnpm
pnpm install
cd artifacts/mobile
cp .env.example .env            # set EXPO_PUBLIC_API_URL to your backend
pnpm exec expo start
```

`EXPO_PUBLIC_API_URL` must be the backend origin **without** a trailing `/api`
(the client appends `/api` itself):

| Environment              | Value                                   |
| ------------------------ | --------------------------------------- |
| iOS simulator            | `http://localhost:3000`                 |
| Android emulator         | `http://10.0.2.2:3000`                  |
| Physical device (LAN)    | `http://<your-computer-LAN-IP>:3000`    |
| Production               | `https://api.bovogo.com`                |

### 3. Admin dashboard (Vite)

```bash
cd admin
cp .env.example .env            # VITE_API_URL=http://localhost:3000
npm install
npm run dev
```

> Note: the upstream `Wegotcha` backend repo did **not** include the `admin`
> module source. A minimal `admin` module has been reconstructed at
> `backend/src/modules/admin/*` (guard + controller + service) backing every
> `/admin/*` endpoint the dashboard calls, protected by JWT + an admin-role
> guard. System config is held in memory (no config table exists in the
> schema); audit reads degrade gracefully if `audit_events` is absent.

---

## Releasing the mobile app

See **[docs/APP_STORE_SUBMISSION.md](docs/APP_STORE_SUBMISSION.md)** for the full
EAS build + App Store / Play submission checklist. In short:

```bash
cd mobile/artifacts/mobile
npm install -g eas-cli
eas login
eas init                        # links the project, writes extra.eas.projectId
eas build --profile production --platform all
eas submit --profile production --platform all
```

Build profiles (`development`, `preview`, `production`) live in
`mobile/artifacts/mobile/eas.json`.
