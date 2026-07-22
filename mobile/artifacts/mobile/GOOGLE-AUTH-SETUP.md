# Google Sign-In Setup (Bovogo Mobile)

Google login uses **OAuth 2.0** via `expo-auth-session`. The "unknown request" error on Google's page means the **redirect URI is not registered** in Google Cloud Console.

---

## 1. Create OAuth client

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → **Credentials**
2. **Create Credentials** → **OAuth client ID**
3. Application type: **Web application** (used for Web client ID + token validation)
4. Copy the **Client ID** (ends in `.apps.googleusercontent.com`)

---

## 2. Set environment variables

**Mobile** (`mobile/artifacts/mobile/.env`):

```env
EXPO_PUBLIC_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Restart Expo with cache clear:

```bash
cd mobile/artifacts/mobile
pnpm exec expo start --clear
```

**Backend** (`backend/.env`) — optional but recommended for audience validation:

```env
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

**EAS builds** — set `EXPO_PUBLIC_GOOGLE_CLIENT_ID` in [eas.json](eas.json) per profile or in EAS secrets.

---

## 3. Register redirect URIs

When the app starts in dev, the console logs:

```text
[Google OAuth] redirectUri: ...
```

Add **every URI you use** to the Web OAuth client's **Authorized redirect URIs**:

| Platform | Typical redirect URI |
|----------|----------------------|
| Expo Go | `https://auth.expo.io/@YOUR_EXPO_USERNAME/bovogo` |
| Web dev | `http://localhost:8082` (or port from `expo start --web`) |
| Native dev build | `bovogo://oauthredirect` (from `makeRedirectUri` with scheme `bovogo`) |

Also add **Authorized JavaScript origins** for web:

- `http://localhost:8082`
- `http://localhost:19006` (if Expo web uses this port)

---

## 4. Verify

1. Open login screen → tap **Google**
2. Google account picker should appear (not "unknown request")
3. After sign-in, app calls `POST /api/auth/oauth` with the ID token

If you see **token audience mismatch** from the backend, ensure `GOOGLE_CLIENT_ID` matches `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.

---

## Related files

- [components/SocialAuthButtons.tsx](components/SocialAuthButtons.tsx) — OAuth UI
- [lib/socialAuth.ts](lib/socialAuth.ts) — client ID resolution
- [backend mobile-auth.service.ts](../../backend/src/modules/mobile-api/services/mobile-auth.service.ts) — token verification
