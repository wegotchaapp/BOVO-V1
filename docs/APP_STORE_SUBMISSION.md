# Bovogo — App Store & Google Play Submission Checklist

This is the end-to-end checklist to take the Bovogo mobile app
(`mobile/artifacts/mobile`) from source to live in both stores using **Expo EAS**.

---

## 0. Prerequisites

- [ ] Apple Developer Program membership ($99/yr) → https://developer.apple.com
- [ ] Google Play Developer account ($25 one-time) → https://play.google.com/console
- [ ] `npm i -g eas-cli` and `eas login`
- [ ] Backend deployed and reachable over HTTPS (e.g. `https://api.bovogo.com`)
- [ ] Production env keys ready (Stripe live keys, Mapbox token)

---

## 1. App configuration (already set in `app.json`)

| Field                     | Value               |
| ------------------------- | ------------------- |
| Name                      | Bovogo              |
| iOS `bundleIdentifier`    | `com.bovogo.app`    |
| Android `package`         | `com.bovogo.app`    |
| `version`                 | `1.0.0`             |
| iOS `buildNumber`         | `1` (auto-increments in prod profile) |
| Android `versionCode`     | `1` (auto-increments in prod profile) |
| Apple Pay merchant id     | `merchant.com.bovogo` |

- [ ] Replace placeholder bundle id / package if `com.bovogo.app` is taken.
- [ ] Confirm the app icon (`assets/images/icon.png`) is 1024×1024 with no alpha
      for iOS. Generate adaptive/splash assets if desired.

## 2. Link the EAS project

```bash
cd mobile/artifacts/mobile
eas init            # creates the project, adds extra.eas.projectId to app.json
```

- [ ] Commit the `extra.eas.projectId` that `eas init` writes.

## 3. Configure production env (`eas.json`)

`eas.json` already defines `development`, `preview`, and `production` profiles.
Update the production `EXPO_PUBLIC_API_URL` to your live backend, and add the
Stripe/Mapbox public keys:

```jsonc
"production": {
  "autoIncrement": true,
  "env": {
    "EXPO_PUBLIC_API_URL": "https://api.bovogo.com",
    "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_live_...",
    "EXPO_PUBLIC_MAPBOX_TOKEN": "pk...."
  }
}
```

- [ ] Production `EXPO_PUBLIC_API_URL` points at the live HTTPS backend (no `/api`).
- [ ] Live Stripe publishable key set (and live `STRIPE_*` keys set on the backend).

## 4. App signing / credentials

EAS manages credentials for you (recommended):

- [ ] iOS: run the build once; let EAS create the Distribution Certificate and
      Provisioning Profile. (Or supply your own in App Store Connect.)
- [ ] Android: let EAS generate and store the upload keystore
      (`eas credentials`). **Back this keystore up** — losing it blocks updates.
- [ ] Apple Pay (optional): enable the Merchant ID `merchant.com.bovogo` in the
      Apple Developer portal if you ship Apple Pay.

## 5. Build

```bash
eas build --profile production --platform ios
eas build --profile production --platform android
# or both:
eas build --profile production --platform all
```

- [ ] iOS build succeeds (`.ipa`).
- [ ] Android build succeeds (`.aab`).

## 6. Store listings

### App Store Connect (iOS)
- [ ] Create the app (bundle id `com.bovogo.app`).
- [ ] Screenshots: 6.7" and 6.5" iPhone (required).
- [ ] Description, keywords, support URL, marketing URL.
- [ ] Privacy policy URL (**required** — has location, payments, accounts).
- [ ] App Privacy "Nutrition Label": declare Location, Contact Info, Payment
      (via Stripe), Identifiers, Usage Data.
- [ ] Sign-in required → provide a **demo account** for App Review.
- [ ] Age rating questionnaire.

### Google Play Console (Android)
- [ ] Create the app (package `com.bovogo.app`).
- [ ] Store listing: short + full description, feature graphic, screenshots.
- [ ] Privacy policy URL.
- [ ] Data Safety form: Location, Personal info, Financial info.
- [ ] Content rating questionnaire.
- [ ] Provide a demo account for review.

## 7. Submit

```bash
# Fill in eas.json > submit.production first (appleId, ascAppId, appleTeamId,
# and the Google Play service-account JSON path).
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

- [ ] iOS submitted to App Store Connect → TestFlight → App Review.
- [ ] Android `.aab` uploaded to the chosen track (start with `internal`).

## 8. Pre-submit smoke test (against production backend)

- [ ] Register a new account, log in, log out, log back in.
- [ ] Complete onboarding + role selection.
- [ ] Post a trip (driver); search/list trips; open trip detail; reply.
- [ ] Book a seat (rider); view "My Bookings".
- [ ] Fill a trip → trip group is created; send a group message.
- [ ] Earnings screen loads for a driver.
- [ ] Subscribe flow opens Stripe Payment Sheet (live test card) — or shows the
      graceful "not configured" message if Stripe is intentionally off.
- [ ] Unread reply badges update.

## 9. Common gotchas

- **HTTP blocked on device builds:** iOS/Android release builds require HTTPS.
  Use a real HTTPS backend, not `http://localhost`.
- **pnpm monorepo on EAS:** the app lives in a pnpm workspace. If EAS build has
  trouble resolving workspace deps, set `EAS_NO_VCS=1` is *not* the fix — instead
  ensure `mobile/pnpm-lock.yaml` is committed and consider building from the app
  directory with `eas build` run inside `artifacts/mobile`.
- **Keystore loss = no updates.** Back up the Android keystore from
  `eas credentials`.
- **Apple "Guideline 5.1.1"**: include the privacy policy + a working demo login.
