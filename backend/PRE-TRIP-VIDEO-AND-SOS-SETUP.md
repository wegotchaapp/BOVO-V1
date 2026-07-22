# Pre-Trip Car Video + SOS — Setup Guide

This guide covers everything needed to run the **mandatory pre-trip vehicle video** and **real SOS** features in local dev and production.

---

## What these features need

| Layer | Pre-trip video | SOS |
|-------|----------------|-----|
| **Mobile auth** | Logged-in driver (Bearer token) | Logged-in user (Bearer token) |
| **Backend APIs** | `POST /api/trips/:id/start-video`, `POST /api/trips/:id/start` | `POST /api/safety/sos` |
| **File storage** | AWS S3 bucket `bovogo-trip-videos` (or local `uploads/` in dev) | — |
| **SMS** | — | Twilio → user's emergency contact |
| **Device (no API key)** | Camera + microphone | Location, phone dialer, SMS composer |

---

## 1. Database migration (once per environment)

Adds `start_video_url` and `started_at` to `mobile_trips`.

```bash
cd backend
# Uses DATABASE_URL from your shell or .env
node scripts/add-trip-start-video.js
```

Expected output: `mobile_trips start video columns ready`

---

## 2. Backend environment variables

Copy from `.env.example` if needed:

```bash
cp .env.example .env
```

### Required for the app to boot

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis (BullMQ / queues) |
| `JWT_SECRET` | Platform JWT (min 32 chars): `openssl rand -hex 32` |

### Required for pre-trip video (production)

| Variable | Purpose |
|----------|---------|
| `APP_URL` | Public API base URL stored on video records (e.g. `https://api.bovogo.com`) |
| `AWS_ACCESS_KEY_ID` | IAM user with S3 write access |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `AWS_REGION` | e.g. `us-east-1` |

**Dev fallback:** If AWS keys are missing or placeholder-shaped, videos are written to `backend/uploads/bovogo-trip-videos/` and served at `{APP_URL}/uploads/...`. Fine for local testing; use real S3 in production.

### Required for SOS emergency-contact SMS

| Variable | Purpose |
|----------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info |
| `TWILIO_PHONE_NUMBER` | Twilio number in E.164 format (e.g. `+15551234567`) |

**Note:** Twilio sends SMS to the user's **emergency contact** (from onboarding). It cannot text 911. The app opens the device dialer and SMS composer for 911 separately.

### Required for founding-member insurance placeholder emails

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key — sends booking + pre-trip video emails |
| `RESEND_FROM_EMAIL` | Verified sender in Resend (e.g. `hello@wegotcha.com`) |

Emails are sent **directly via Resend** (no Redis queue required for these mobile emails). Founding members receive the “fully insured” placeholder line; others get a plain booking or video confirmation.

- **Rider:** after mobile booking confirm (`POST /api/bookings/confirm` or dev instant book)
- **Driver:** after pre-trip video upload (`POST /api/trips/:id/start-video`)

### Not required for these two features

Stripe, Mapbox, Supabase, Noonlight, Checkr — used elsewhere in the monorepo. Redis is still required for the main app boot but mobile insurance emails skip the BullMQ queue.

---

## 3. AWS S3 setup (pre-trip video)

### Step 1 — Create bucket

1. AWS Console → **S3** → **Create bucket**
2. Bucket name: **`bovogo-trip-videos`**
3. Region: same as `AWS_REGION` (e.g. `us-east-1`)
4. Block public access: **on** (videos are private; URLs are app-served or presigned later)

### Step 2 — IAM policy

Create an IAM user (or role for Railway/ECS) with this policy (replace bucket name if you change it):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::bovogo-trip-videos/*"
    }
  ]
}
```

### Step 3 — Add keys to backend

```env
AWS_ACCESS_KEY_ID=AKIA................   # real key, 20 chars after AKIA
AWS_SECRET_ACCESS_KEY=................  
AWS_REGION=us-east-1
APP_URL=https://your-production-api-url.com
```

Real access keys match the pattern `AKIA` + 16 uppercase alphanumeric characters. Placeholder values like `AKIA_your-aws-access-key` are ignored and fall back to local disk storage.

---

## 4. Twilio setup (SOS emergency contact SMS)

### Step 1 — Account

1. [Twilio Console](https://console.twilio.com/)
2. Copy **Account SID** and **Auth Token**

### Step 2 — Phone number

1. **Phone Numbers** → **Buy a number** (or use trial number for dev)
2. Must support **SMS**
3. Copy number in E.164 format (`+1...`)

### Step 3 — Add to backend

```env
TWILIO_ACCOUNT_SID=AC.....................
TWILIO_AUTH_TOKEN=........................
TWILIO_PHONE_NUMBER=+15551234567
```

### Step 4 — Emergency contact data

Users must complete onboarding step **Emergency Contact** (`emergencyName`, `emergencyPhone` on `mobile_users`). SOS reads these fields — no separate `emergency_contacts` table sync is required for the mobile app.

**Trial accounts:** SMS only works to verified numbers until the account is upgraded.

---

## 5. Mobile app configuration

File: `mobile/artifacts/mobile/.env`

```env
EXPO_PUBLIC_API_URL=https://your-api-domain.com
```

No extra keys for video or SOS on mobile. Camera, mic, and location use OS permissions (configured in `app.json`).

### Device permissions

| Permission | When | Feature |
|------------|------|---------|
| Camera + microphone | Pre-trip video screen | Record car video (no gallery) |
| Location (foreground) | Onboarding emergency step + SOS | Live location in alerts |
| Phone / SMS | None at runtime | OS opens dialer / composer |

### Build requirement

`expo-camera` and `expo-sms` need a **development build or production build** — not Expo Go.

```bash
cd mobile/artifacts/mobile
pnpm exec expo prebuild   # if using bare workflow
# or EAS Build for TestFlight / Play internal testing
```

---

## 6. API reference (mobile contract)

All endpoints require:

```http
Authorization: Bearer <token-from-login-or-register>
```

Base URL: `{EXPO_PUBLIC_API_URL}/api`

### Auth (existing)

| Method | Path | Body |
|--------|------|------|
| `POST` | `/auth/register` | `{ name, email, phone, password }` |
| `POST` | `/auth/login` | `{ email, password }` |
| `PATCH` | `/auth/me` | `{ emergencyName, emergencyPhone, role, onboarded, ... }` |

### Pre-trip video (driver)

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/trips/:id/start-video` | `multipart/form-data`, field `video`, max 25MB, video MIME only |
| `POST` | `/trips/:id/start` | 400 if `start_video_url` not set; sets `status: in_progress` |

Example flow:

1. Driver creates trip → `POST /trips`
2. Driver records video on device → `POST /trips/:id/start-video`
3. Driver starts ride → `POST /trips/:id/start`
4. Tracking unlocked → existing booking/location APIs

### SOS

| Method | Path | Body |
|--------|------|------|
| `POST` | `/safety/sos` | `{ latitude?, longitude?, tripId? }` |

Response (always 200 if authenticated):

```json
{ "ok": true, "contactNotified": true }
```

or if contact/SMS unavailable:

```json
{ "ok": true, "contactNotified": false, "reason": "no_emergency_contact" }
```

Device-side (automatic in app, no backend):

1. SMS composer → `911` with `Help required. My live location: https://www.google.com/maps?q=lat,lng`
2. Phone dialer → `tel:911`

---

## 7. Railway deployment checklist

1. **Postgres + Redis** add-ons attached; `DATABASE_URL` and `REDIS_URL` set automatically.
2. Set secrets in Railway → Variables:
   - `JWT_SECRET`, `APP_URL`
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
3. Run migration against production DB (one-time):

   ```bash
   railway run node scripts/add-trip-start-video.js
   ```

4. Deploy backend; confirm health: `GET /health`
5. Point mobile `EXPO_PUBLIC_API_URL` at Railway public URL.
6. Ship a dev/production mobile build with camera permissions.

---

## 8. Local verification

```bash
# Terminal 1 — backend
cd backend
npm run start:dev

# Terminal 2 — migration (if not run yet)
cd backend
node scripts/add-trip-start-video.js

# Terminal 3 — mobile
cd mobile/artifacts/mobile
pnpm dev
```

Quick API smoke (requires running server):

1. Register → save `token`
2. `PATCH /api/auth/me` with `role: driver`, `emergencyName`, `emergencyPhone`
3. `POST /api/trips` → save `tripId`
4. `POST /api/trips/:tripId/start` → expect **400** (no video)
5. `POST /api/trips/:tripId/start-video` with multipart video → expect **200**
6. `POST /api/trips/:tripId/start` → expect **200**, `status: in_progress`
7. `POST /api/safety/sos` with `{ latitude, longitude }` → expect **200**

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Video upload 500 | Invalid AWS keys hitting real S3 | Use real `AKIA...` keys or remove placeholders so local fallback works |
| Start returns 400 | No video uploaded | Call `start-video` first |
| SOS contact not notified | Missing `emergency_phone` on user | Complete onboarding emergency step |
| SOS `sms_failed` | Twilio SID/token placeholder or trial limits | Set real Twilio creds; verify recipient on trial |
| Camera not available | Expo Go | Use dev build |
| 911 SMS empty location | Location permission denied | Grant location in onboarding or Settings |

---

## 10. Current environment audit (this machine)

Generated from local `.env` files — **values not shown**, status only.

### Backend (`backend/.env`)

| Variable | Status | Needed for |
|----------|--------|------------|
| `DATABASE_URL` | ✅ Set | App boot + trips |
| `REDIS_URL` | ✅ Set | App boot |
| `JWT_SECRET` | ✅ Set | App boot |
| `APP_URL` | ✅ Set | Video URL storage |
| `AWS_REGION` | ✅ Set | S3 region |
| `AWS_ACCESS_KEY_ID` | ⚠️ Placeholder | Pre-trip video (prod) |
| `AWS_SECRET_ACCESS_KEY` | ⚠️ Placeholder | Pre-trip video (prod) |
| `TWILIO_ACCOUNT_SID` | ⚠️ Placeholder | SOS contact SMS |
| `TWILIO_AUTH_TOKEN` | ⚠️ Placeholder | SOS contact SMS |
| `TWILIO_PHONE_NUMBER` | ✅ Set | SOS contact SMS |

**Action:** Replace AWS and Twilio placeholders with production credentials before go-live. Local dev works with disk upload fallback and SOS returning `contactNotified: false`.

### Mobile (`mobile/artifacts/mobile/.env`)

| Variable | Status |
|----------|--------|
| `EXPO_PUBLIC_API_URL` | ✅ Set |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | ✅ Set |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | ✅ Set |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ⚠️ Placeholder (bookings only) |

---

## Related files

| File | Role |
|------|------|
| `backend/scripts/add-trip-start-video.js` | DB migration |
| `backend/src/modules/mobile-api/services/mobile-trips.service.ts` | Video upload + start |
| `backend/src/modules/mobile-api/services/mobile-safety.service.ts` | SOS Twilio SMS |
| `mobile/artifacts/mobile/app/pre-trip-video.tsx` | Camera + upload UI |
| `mobile/artifacts/mobile/lib/safety.ts` | SOS device flow |
| `mobile/artifacts/mobile/lib/trips.ts` | `uploadStartVideo`, `startTrip` |
