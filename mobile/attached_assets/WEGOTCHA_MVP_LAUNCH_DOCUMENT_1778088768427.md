# WeGotcha MVP: Complete Launch Document

---

## 📋 TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [What Was Built](#2-what-was-built)
3. [What Was Changed (This Session)](#3-what-was-changed-this-session)
4. [Architecture](#4-architecture)
5. [Infrastructure Setup](#5-infrastructure-setup)
6. [API Keys Acquisition](#6-api-keys-acquisition)
7. [Cost Breakdown](#7-cost-breakdown)
8. [Deployment Steps](#8-deployment-steps)
9. [Launch Checklist](#9-launch-checklist)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. PROJECT OVERVIEW

### Business Model
WeGotcha is a **Cost-Sharing Carpooling Platform** where drivers only recover actual expenses (gas, tolls, IRS mileage rate at $0.67/mile). Drivers do **not** earn profit from rides.

### Regulatory Status
- **Not a TNC** (Transportation Network Company).
- **Exempt** from Texas Occupations Code Ch. 2401+ (commercial licensing, commercial insurance mandates).
- **Compliance Focus**: CCPA (Privacy), Texas BUIA (Biometric Consent), IRS 1099-K (Tax reporting >$600).

### Key Rules
- Drivers recover actual costs only (no surge pricing, no profit).
- Platform charges a fixed "Service Fee" (non-profit operational cost recovery).
- Riders pay for the ride cost + platform fee + Stripe processing fees.

---

## 2. WHAT WAS BUILT

### Frontend (Expo / React Native)
- **Authentication**: Login, Signup (Email/Phone/Password), Social Login (Apple/Google), OTP verification, Password reset.
- **Onboarding**: 6-step wizard (Photo, Display Name, Bio, Languages, Emergency Contacts, ID Verification).
- **Trip Management**: Post trips, Search trips (filters), Trip detail, Live tracking.
- **Booking System**: Create booking, View bookings (Upcoming/Past), Trip rating.
- **Driver Features**: My Trips dashboard, Vehicle registration (Add/Photos/Documents/Status), Earnings dashboard.
- **Safety Suite**: SOS Button (3-sec hold), SOS Overlay (10-sec countdown, safe word), "I Feel Unsafe" screen, Live GPS tracking, Trip share links.
- **Chat**: Real-time messaging per booking, Twilio masked calling.
- **Profile**: User profile, badges, stats, notification settings, emergency contacts.

### Backend (NestJS)
- **Auth**: JWT, Refresh tokens, Twilio Verify, Email verification, Stripe Identity KYC.
- **Trips & Bookings**: Full lifecycle (Posted → Booked → En Route → Completed), Seat management, Luggage, Preference matching.
- **Payments (Stripe Connect)**: Rider charges, Driver payouts, Refunds, IRS 1099-K compliance ($600 threshold), W-9 collection.
- **Safety Engine**: Real-time GPS pings (PostGIS), Route deviation detection (>5mi), SOS with emergency SMS, Trip overrun detection (>60min).
- **Notifications**: Multi-channel (Push/SMS/Email) via BullMQ queues, Booking reminders (48h/2h).
- **Trust & Safety**: User reports, Moderation actions, Appeals, Audit logging.
- **Privacy**: Data export, Account deletion, Auto-purge old data.

### Database (~30+ Tables)
- **Core**: users, profiles, vehicles, verifications.
- **Trips**: trips, trip_preferences, trip_zones, bookings, booking_luggage, booking_status_log.
- **Payments**: payments, payouts, refunds, insurance_policies, compliance_logs.
- **Safety**: trip_pings, sos_events, reports, moderation_actions, suspensions, incidents, deviation_events, appeals.
- **Comms**: conversations, messages, call_records, notification_log, devices, emergency_contacts.
- **Infrastructure**: refresh_tokens, audit_events, data_deletion_requests.

---

## 3. WHAT WAS CHANGED (THIS SESSION)

### A. Codebase Cleanup
1. Removed TNC-specific features (commercial insurance, vehicle inspections).
2. Removed Noonlight (SOS) integration — SOS now uses local notifications only.
3. Removed Checkr (Background Checks) — endpoints return "Unavailable" stubs for MVP.
4. Fixed build errors (`auth.service.ts`, `health.controller.ts`, `data-source.ts`).
5. Verified `npm run build` completes with **0 errors**.

### B. Database & Migrations
1. Created manual migration: `1746284700000-ComplianceColumnsAddition.ts`.
2. Added missing columns to `users`, `profiles`, `bookings`, `trips`, `sos_events`.
3. Added new tables: `audit_events`, `data_deletion_requests`, `deviation_events`, `appeals`.

### C. Compliance Model
1. Updated `/health/compliance` endpoint to reflect "cost-sharing carpooling" status.
2. Disabled Checkr/Noonlight keys in `.env` (commented out).
3. Simplified identity module (removed CheckrService, RecheckScheduler).
4. Simplified safety service (removed Noonlight API calls).

---

## 4. ARCHITECTURE

### Tech Stack
| Component | Technology |
|-----------|------------|
| Backend | NestJS 11, TypeScript |
| Database | PostgreSQL (Supabase) |
| Cache/Queue | Redis (Upstash) + BullMQ |
| Real-time | Socket.io |
| Frontend | Expo SDK 52, React Native, Zustand |
| Payments | Stripe Connect |
| SMS | Twilio Verify |
| Email | Resend |
| Maps | Mapbox |
| Hosting | Render (Free tier) |
| Storage | Supabase Storage |

### Data Flow
1. Rider searches → Backend queries PostgreSQL for matching trips.
2. Rider books → Stripe creates PaymentIntent (holds funds).
3. Trip completes → Stripe captures payment → Transfers to driver's connected account.
4. During trip → Frontend sends GPS pings via Socket.io → Backend stores in PostGIS.
5. SOS activated → Backend sends SMS via Twilio + Push via Expo.

---

## 5. INFRASTRUCTURE SETUP

### 5.1 Database (Supabase)
1. Go to [supabase.com](https://supabase.com) → Sign up with GitHub.
2. Click **New Project** → Name: `wegotcha-mvp` → Generate password → **Save it**.
3. Go to **Project Settings** → **Database** → Copy **Connection string** (URI format).
4. Save as `DATABASE_URL` in `.env`.

### 5.2 Redis (Upstash)
1. Go to [upstash.com](https://upstash.com) → Sign up.
2. Click **Create Database** → Name: `wegotcha-redis` → Select region.
3. Copy the **URL** from REST API tab (starts with `https://...`).
4. Save as `REDIS_URL` in `.env`.

### 5.3 File Storage (Supabase)
1. In Supabase dashboard → **Storage** → **New Bucket**.
2. Create **Two Buckets**:
   - `wegotcha-public` → Toggle **Public ON** (Profile photos, Vehicle photos).
   - `wegotcha-private` → Toggle **Public OFF** (IDs, Insurance docs).
3. Go to **Project Settings** → **API** → Copy **Project URL** → Save as `SUPABASE_URL`.
4. Copy **service_role** key → Save as `SUPABASE_SERVICE_KEY`.

### 5.4 Hosting (Render)
1. Go to [render.com](https://render.com) → Sign up with GitHub.
2. Click **New +** → **Web Service** → Connect GitHub → Select `wegotcha-backend` repo.
3. Configure:
   - **Name**: `wegotcha-backend`
   - **Region**: Closest to you
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Plan**: Free
4. Add **all environment variables** (see Section 6).
5. Click **Create Web Service** → Wait ~5 mins for deployment.

---

## 6. API KEYS ACQUISITION

### 6.1 Stripe (Payments)
1. Log in to [dashboard.stripe.com](https://dashboard.stripe.com).
2. **Toggle ON** "Test Mode" (top right).
3. **Developers** → **API keys**:
   - `STRIPE_SECRET_KEY`: Reveal and copy `sk_test_...`
   - `STRIPE_PUBLISHABLE_KEY`: Copy `pk_test_...`
4. **Developers** → **Webhooks** → **Add endpoint**:
   - **URL**: `http://localhost:3000/payments/webhook` (use Render URL later)
   - **Events**: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - **Secret**: Copy `whsec_...` → `STRIPE_WEBHOOK_SECRET`

### 6.2 Twilio (SMS & Verify)
1. Log in to [console.twilio.com](https://console.twilio.com).
2. **Dashboard** → Copy **Account SID** (`AC...`) → `TWILIO_ACCOUNT_SID`.
3. Click **Eye icon** next to Auth Token → Copy → `TWILIO_AUTH_TOKEN`.
4. **Phone Numbers** → **Manage** → **Active Numbers** → Copy number → `TWILIO_PHONE_NUMBER`.
5. **Verify** → **Services** → Click your service → Copy **Service SID** (`VA...`) → `TWILIO_VERIFY_SERVICE_SID`.

### 6.3 Mapbox (Maps & Routing)
1. Go to [account.mapbox.com](https://account.mapbox.com) → Sign up.
2. Copy **Default public token** (`pk...`) → `MAPBOX_ACCESS_TOKEN`.
3. Create token → Select **Secret scope** → Copy (`sk...`) → `MAPBOX_SECRET_TOKEN`.

### 6.4 Resend (Emails)
1. Go to [resend.com](https://resend.com) → Sign up.
2. **API Keys** → **Create API Key** → Name: `wegotcha-dev` → Copy (`re_...`) → `RESEND_API_KEY`.
3. Set `RESEND_FROM_EMAIL` to your verified domain email.

---

## 7. COST BREAKDOWN

### Monthly Fixed Costs
| Service | Cost | Notes |
|---------|------|-------|
| Supabase (DB + Storage) | $0 | Free tier (500MB DB, 1GB Storage) |
| Upstash (Redis) | $0 | Free tier (10k commands/day) |
| Render (Hosting) | $0 | Free tier (sleeps after 15m inactivity) |
| Twilio Phone # | $1.15/mo | Required to keep number active |
| **Total Fixed** | **~$1.15/mo** | |

### Variable Costs (Pay-as-you-go)
| Service | Cost | Notes |
|---------|------|-------|
| Stripe | 2.9% + $0.30 | Per transaction. Deducted from payment. |
| Twilio Verify | ~$0.06 | Per user signup SMS |
| Mapbox | $0 | Free up to 50,000 map loads/mo |
| Resend | $0 | Free up to 3,000 emails/mo |

### Scenarios
- **Development (0-50 users)**: ~$4.15/mo (Twilio deposit + phone #)
- **Soft Launch (500 users)**: ~$31.15/mo out of pocket
- **Stripe fees are never paid from your pocket** — they are deducted from rider payments.

### One-Time Cost
- **Twilio Deposit**: ~$20.00 (credits used for first SMS messages)

---

## 8. DEPLOYMENT STEPS

### Step 1: Prepare Backend for GitHub
1. Create `.gitignore` in `backend/` folder:
   ```
   node_modules/
   dist/
   .env
   *.log
   uploads/
   ```
2. Open PowerShell:
   ```powershell
   cd "C:\Users\sarim\OneDrive\Documents\Carpooling App\backend"
   git init
   git add .
   git commit -m "Initial backend setup"
   ```

### Step 2: Create GitHub Repository
1. Go to [github.com/new](https://github.com/new).
2. **Name**: `wegotcha-backend`
3. **Visibility**: Private
4. **Do NOT** check "Add README" or "Add .gitignore".
5. Click **Create repository**.

### Step 3: Push to GitHub
```powershell
git remote add origin https://github.com/YOUR_USERNAME/wegotcha-backend.git
git branch -M main
git push -u origin main
```

### Step 4: Deploy to Render
1. Go to [render.com](https://render.com) → **New +** → **Web Service**.
2. Connect GitHub → Select `wegotcha-backend` repo.
3. Fill in configuration (Section 5.4).
4. **Add ALL Environment Variables** (Section 6 keys + `DATABASE_URL`, `REDIS_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`).
5. Click **Create Web Service**.

### Step 5: Update Frontend
1. Update `wegotcha/.env` with your Render URL:
   ```
   EXPO_PUBLIC_API_URL=https://wegotcha-backend.onrender.com
   ```
2. Build APK: `eas build --platform android`.

---

## 9. LAUNCH CHECKLIST

### Phase 1: Infrastructure
- [ ] Supabase project created
- [ ] Upstash database created
- [ ] Supabase buckets created (`wegotcha-public`, `wegotcha-private`)
- [ ] All API keys collected

### Phase 2: Backend
- [ ] `.gitignore` created in `backend/`
- [ ] Backend pushed to GitHub
- [ ] Render Web Service created
- [ ] All environment variables added to Render
- [ ] Backend deployed successfully
- [ ] `GET /health` endpoint returns 200 OK
- [ ] Database migration run

### Phase 3: Frontend
- [ ] `EXPO_PUBLIC_API_URL` updated in `wegotcha/.env`
- [ ] Test login/signup works
- [ ] Test trip posting works
- [ ] Test booking + payment works (Stripe test card `4242 4242 4242 4242`)
- [ ] Test chat works
- [ ] Test GPS tracking works

### Phase 4: Production
- [ ] Switch Stripe to Live Mode (replace test keys with live keys)
- [ ] Update Webhook URL to production Render URL
- [ ] Update `APP_URL` in `.env` to production domain
- [ ] Update `ALLOWED_ORIGINS` to include production domain
- [ ] Build production APK/IPA
- [ ] Submit to App Store / Google Play

---

## 10. TROUBLESHOOTING

### Backend Fails to Start on Render
1. Check **Logs** in Render dashboard.
2. Verify **all environment variables** are added.
3. Verify `DATABASE_URL` and `REDIS_URL` are correct.
4. Run `npm run build` locally to check for compilation errors.

### Database Connection Error
1. Ensure Supabase database is **active**.
2. Verify `DATABASE_URL` format: `postgresql://postgres.[project-id]:[PASSWORD]@[HOST]:5432/postgres`
3. Check Supabase **IP Allow List** (disable if enabled for testing).

### Redis Connection Error
1. Verify `REDIS_URL` starts with `rediss://` (not `redis://`).
2. Check Upstash database is **active**.

### Webhook Not Receiving Events
1. Verify `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint.
2. Ensure Render URL is correct in Stripe Webhook settings.
3. Check Render logs for incoming POST requests.

### Images Not Loading
1. Verify `wegotcha-public` bucket is **Public**.
2. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct.
3. Check browser console for CORS errors.

---

## CONTACT & SUPPORT
- **Backend Code**: `C:\Users\sarim\OneDrive\Documents\Carpooling App\backend`
- **Frontend Code**: `C:\Users\sarim\OneDrive\Documents\Carpooling App\wegotcha`
- **Seed Credentials**: `driver1@test.com`, `rider@test.com`, `admin@test.com` (pass: `testpass123`)
- **Ports**: Backend `3000`, Expo `8081`, Postgres `5433`, Redis `6379`

---

*Document generated for WeGotcha MVP Launch — May 2026*
