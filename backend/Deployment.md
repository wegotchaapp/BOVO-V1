# Backend — Deployment Guide

This document covers how to build, configure, and deploy the Bovogo NestJS backend.

---

## Stack overview

| Layer | Technology |
|-------|------------|
| Runtime | Node 20 (Alpine) |
| Framework | NestJS 11 |
| Database | PostgreSQL (TypeORM) |
| Queue | Redis + BullMQ |
| Auth | Supabase + JWT |
| Email | React Email + Resend |
| File uploads | AWS S3 (Rekognition) |
| Push notifications | Expo Push + Twilio |
| Payments | Stripe Connect |
| Hosting | Railway |

---

## Prerequisites

- Docker 24+
- Node 20 (for local dev and CI)
- Access to Railway project
- All environment variables listed in `.env.example`

---

## Environment variables

Copy `.env.example` to `.env` and fill in real values before running locally.
**Never commit `.env` to the repository** — it is in `.gitignore` and `.dockerignore`.

In production (Railway) all variables are injected via the Railway dashboard or
secrets. The CI workflow writes them from GitHub Actions secrets during deploy.

### Required at startup

The app **will not boot** if any of these are missing:

| Variable | Where to get it |
|----------|-----------------|
| `DATABASE_URL` | Railway Postgres add-on / Supabase connection string |
| `REDIS_URL` | Railway Redis add-on |
| `JWT_SECRET` | Generate: `openssl rand -hex 32` |
| `SUPABASE_URL` | Supabase project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings → API |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Webhooks |
| `RESEND_API_KEY` | Resend dashboard |
| `TWILIO_ACCOUNT_SID` | Twilio console |
| `TWILIO_AUTH_TOKEN` | Twilio console |
| `TWILIO_PHONE_NUMBER` | Twilio console |

### Optional but recommended

| Variable | Purpose |
|----------|---------|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Profile photo uploads via S3 |
| `MAPBOX_ACCESS_TOKEN` | Geocoding |
| `CHECKR_API_KEY` | Background checks (Phase 2) |
| `NOONLIGHT_API_KEY` | SOS escalation |
| `STRIPE_PRICE_ID` | Bovogo Premium subscription |

---

## Building the Docker image

```bash
# Build from inside the backend/ directory
cd backend
docker build -t bovogo-backend:latest .

# Or from repo root with explicit context
docker build -f backend/Dockerfile -t bovogo-backend:latest backend/
```

The Dockerfile is a **multi-stage build**:

1. **builder** — installs Alpine build tools (required for `bcrypt` native bindings),
   runs `npm ci`, compiles TypeScript with `nest build`, then prunes dev dependencies.
2. **runner** — copies only `dist/`, production `node_modules/`, and `package.json`.
   Runs as the unprivileged `node` user. Exposes port `3000`.

---

## Running locally with Docker

```bash
docker run --rm \
  --env-file backend/.env \
  -p 3000:3000 \
  bovogo-backend:latest
```

The health endpoint responds at `GET /health`. The container's `HEALTHCHECK`
polls it every 30 s; the first check fires after a 45 s start-up grace period.

---

## Database migrations

Migrations are TypeScript files under `src/database/migrations/`.

### Local development (ts-node, no build needed)

```bash
# Inside backend/
npm run db:migrate      # apply pending migrations
npm run db:generate     # generate a new migration from entity diff
npm run db:revert       # roll back the last migration
```

### After a production build (compiled dist/)

```bash
# Run from backend/ after npm run build
npm run migration:run   # uses dist/database/data-source.js
```

`data-source.ts` detects the runtime: when the file extension is `.js`
(compiled output) it resolves migrations from `dist/database/migrations/*.js`;
when it is `.ts` (ts-node) it resolves from `src/database/migrations/*.ts`.

### In the CI/CD pipeline

Migrations run from the CI runner **after the build step and before `railway up`**
so the database schema is ready before new app code starts serving traffic.
See `.github/workflows/backend-deploy.yml`.

---

## File uploads

The app writes uploaded files to `<cwd>/uploads/` when S3 credentials are absent.
In Docker that path is inside the container and is **lost on restart**.

For production:

- Provide `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`.
- The profiles service will then store files in S3 and serve signed URLs.
- If you must use local disk for any reason, mount a persistent volume at
  `/app/uploads` in your Docker Compose or Railway volume config.

---

## GitHub Actions CI/CD

### CI (`backend-ci.yml`)

Triggered on pull requests that touch `backend/`. Runs:

1. TypeScript type check
2. ESLint
3. Unit tests (against an ephemeral Postgres 16 service container)
4. Production build

### Deploy (`backend-deploy.yml`)

Triggered on push to `main` when `backend/` changes. Steps:

1. Install dependencies
2. Inject production secrets into `.env`
3. TypeScript + lint checks
4. `npm run build` → compiles to `dist/`
5. `npm run migration:run` → applies pending DB migrations (uses `dist/database/data-source.js`)
6. `railway up` → pushes code and triggers Railway to build & deploy the Docker image

#### Required GitHub Actions secrets

```
DATABASE_URL
REDIS_URL
JWT_SECRET
STRIPE_SECRET_KEY
APP_URL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
TWILIO_VERIFY_SERVICE_SID
RESEND_API_KEY
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
RAILWAY_TOKEN
RAILWAY_SERVICE_ID
```

---

## Health check

```
GET /health
```

Returns `200 OK` when the database connection is healthy (TypeORM ping).
The Dockerfile `HEALTHCHECK` and any orchestrator readiness probe should
target this endpoint.

```
GET /health/compliance
```

Returns a JSON summary of the platform's regulatory and data-retention posture
(useful for auditors; no auth required).

---

## Swagger / API docs

Available at `/docs` in non-production environments (`APP_ENV !== 'production'`).
Disabled in production to avoid exposing the API schema publicly.

---

## Known limitations and operational notes

| Area | Note |
|------|------|
| WebSocket | `@nestjs/platform-socket.io` requires sticky sessions when running multiple replicas. On Railway, enable "sticky sessions" in the network settings or limit to one replica. |
| BullMQ | All queue workers share the same Redis instance. Do not use `REDIS_URL` with connection limits below 20. |
| `DATABASE_SYNCHRONIZE` | Never set to `true` in production; managed exclusively via migrations. |
| Swagger in production | Disabled. Set `APP_ENV=development` only on staging. |
| Uploads volume | See *File uploads* section above. |
