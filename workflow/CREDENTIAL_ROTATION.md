# Credential rotation runbook

Two jobs, and they are not the same kind of thing.

| | What it is | Urgency |
| --- | --- | --- |
| **Supabase database password** | A live credential, exposed in public-ish history since 2026-06-23 | Rotate now |
| **`ALLOWED_ORIGINS`** | A secret that has never existed and now must | Before the next deploy |

Only Sushant can do either. Neither is safe to automate.

---

## 1. Supabase database password

### Why

`backend/fix_db_temp.js` embedded the live `postgres` credential for
`db.msrgmsvkuoqouohqijrp.supabase.co`. Codex removed it from the working tree,
which does not remove it from history.

- Introduced in `c8377f9`, the **initial commit**, 2026-06-23
- Present on **`origin/main`**, reachable from **every** local and remote ref
- On GitHub for roughly ten weeks

Rewriting history will not fix this. Clones, forks and GitHub's own object caches
keep the old blobs, and it would mean rewriting `main`. **Rotation is the only
control that actually closes it.**

### Before you start — the whole inventory

Rotating invalidates the password everywhere at once, so know every consumer
first. Anything missed is an outage, not a warning.

| Where | What holds it | How to check |
| --- | --- | --- |
| Supabase | source of truth | Project Settings → Database |
| GitHub Actions | secret `DATABASE_URL` | Settings → Secrets and variables → Actions |
| Railway | service variables | Railway dashboard → service → Variables |
| Your Mac | `backend/.env` | gitignored, holds the live credential today |
| Any other machine | its own `backend/.env` | anyone who has run the backend locally |

**Unaffected — do not touch:** `.mcp.json` (Supabase MCP is OAuth, no credential;
its Stitch entry is `${STITCH_API_KEY}`, an env reference, not a literal),
`.codex/config.toml` (project ref only), `admin/.env` and
`mobile/artifacts/mobile/.env` (no database credential), and the eight
`backend/scripts/*.js` files that embed a `localhost` URL with a throwaway
password.

> [!warning] Railway may be the real runtime source
> The workflow writes a `.env` during build **and** runs `railway up`. Railway
> normally injects its own service variables at runtime, which would override the
> baked file. Check the Railway dashboard before assuming the GitHub secret is
> what production actually reads — if both exist, update both.

### Steps

1. **Look at Railway first**, before rotating. Note whether a `DATABASE_URL`
   variable exists on the service. You need to know this while the old password
   still works.
2. **Supabase dashboard** → your project → **Project Settings → Database →
   Reset database password**. Copy the new connection string.
3. **GitHub** → repo → Settings → Secrets and variables → Actions → update
   `DATABASE_URL`.
4. **Railway** → service → Variables → update `DATABASE_URL` if it exists there.
   This is what redeploys production.
5. **Your Mac** → update `DATABASE_URL` in `backend/.env`.
6. **Tell anyone else** who runs the backend locally to update theirs.

### Verify, in this order

```bash
# 1. Local backend reaches the database on the new password
cd backend && node -e "require('dotenv').config();const{Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});c.connect().then(()=>c.query('select current_user, now()')).then(r=>{console.log('OK',r.rows[0]);return c.end()}).catch(e=>{console.error('FAIL',e.message);process.exit(1)})"
```

2. Re-run one e2e suite — they read `backend/.env` and hit the real database:
   `node backend/test/e2e/e2e_vehicle.js`
3. Trigger a deploy and confirm the **Run Migrations** step connects.
4. Confirm the deployed API answers `/health`.

### Then, separately

The old password is dead but still readable in history, so anyone who cloned
before today has a string that no longer works — that is the point. Do **not**
follow this with a history rewrite; it buys nothing and rewrites `main`.

Worth doing while you are in there: `DATABASE_URL` currently points at the
**direct** connection (port 5432). For real traffic it should point at the
Supavisor **pooler** (port 6543, transaction mode), keeping 5432 for migrations
only. That is a separate change — do not bundle it with the rotation, or a
failure will be ambiguous.

---

## 2. `ALLOWED_ORIGINS`

### Why

This is **not** a rotation. The secret has never existed. Until now nothing read
it: `main.ts` used `origin: true` and allowed every origin in production, and the
deploy wrote `ALLOWED_ORIGINS=${{ secrets.APP_URL }}` — the API's own address,
which no browser ever sends as an `Origin`.

Codex correctly tightened CORS to enforce an allowlist. `createCorsOptions` now
throws at boot in production when the list is empty, so the deploy fails
deliberately (`9a0c63e`) rather than shipping a crash-looping container.

### What the value should be

A comma-separated list of the **browser** origins that call the API. Not the
API's own URL.

| Client | Needs to be listed? |
| --- | --- |
| Admin dashboard | **Yes** — it is a browser app calling the API cross-origin |
| Expo **web** build | Yes, *if* that build is hosted anywhere |
| Expo **native** (iOS/Android) | **No** — native sends no `Origin` header and passes through by design |

> [!important] The admin dashboard has no home yet
> There is no deploy config in `admin/` and no admin deployment workflow, so its
> production origin does not exist. **Do not invent one.** Either deploy the
> admin dashboard first and use its real origin, or decide the domain now and set
> it before the DNS exists.

### Steps

1. Decide where the admin dashboard will be served from.
2. **GitHub** → repo → Settings → Secrets and variables → Actions → **New
   repository secret**, named `ALLOWED_ORIGINS`.
3. Value: the origins, comma-separated, **scheme and host, no trailing slash** —
   for example `https://admin.bovogo.com` or
   `https://admin.bovogo.com,https://app.bovogo.com`.
4. Deploy. The pre-flight step prints how many origins it allowlisted.

### Verify

1. Open the admin dashboard against the production API and confirm requests
   succeed — a CORS failure appears in the browser console, not in server logs.
2. Confirm the Expo **native** app still works. It should be unaffected; if it
   broke, the allowlist is not the cause.
3. Do both in staging before production.

> [!tip] Local development is unaffected
> `createCorsOptions` allows every origin when `NODE_ENV`/`APP_ENV` is not
> `production`, so `localhost:5173` keeps working without being listed.
