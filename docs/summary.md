# Carpooling App - Progress & Architecture

## Architecture

```
testing-test-main/         # monorepo root (pnpm workspace)
├── artifacts/
│   ├── mobile/            # React Native (Expo) app - port 8081
│   │   └── context/AuthContext.tsx      # auth + token storage
│   ├── api-server/        # Express API server - port 3001
│   │   └── src/app.ts     # routes under /api/*
│   └── web/               # Web admin dashboard
├── lib/
│   ├── db/                # Drizzle ORM schema + migrations
│   │   └── src/schema/    # 45 table definitions
│   ├── api/               # Shared Zod schemas
│   └── api-client/        # Shared API client (reusable)
└── .env                   # DATABASE_URL, PORT, etc.
```

**API URL resolution chain** (mobile): `EXPO_PUBLIC_API_URL` → `EXPO_PUBLIC_DOMAIN` → relative (`""`). If neither env var is set, API calls go to the Expo dev server port.

## Current Status

### Running
| Service       | Port | PID  | Notes                                |
|---------------|------|------|--------------------------------------|
| API server    | 3001 | 2688 | PostgreSQL connected, 47 tables      |
| Expo dev      | 8081 | 2116 | `EXPO_PUBLIC_API_URL=http://192.168.1.15:3001` |

### Infrastructure
| Component    | Status                          |
|-------------|---------------------------------|
| PostgreSQL  | Running (postgresql-x64-18), database `carpooling` created, schema pushed |
| Redis       | ❌ Not available locally        |
| Stripe      | ❌ Skipped (no credentials)     |

### Blocked
1. **No Redis locally** - BullMQ queues and WebSocket pub/sub will fail. Need Redis Desktop or cloud Redis.
2. **mockup-sandbox TS ref conflict** - Pre-existing issue, unrelated to our changes.
3. **Stripe not configured** - Server starts fine but Stripe operations fail.

### Fixes Applied
1. **`app/tracking/[id].tsx:182`** - Added type annotation to `info` parameter in `renderBanner` callback.
2. **`context/AuthContext.tsx`** - Added `if (res.token)` guard before `AsyncStorage.setItem` calls to prevent crash when API is unreachable.

## Key Decisions

- API server runs on port **3001** (internal), not the Expo dev port (8081)
- Mobile app uses `EXPO_PUBLIC_API_URL` to discover the API server
- Drizzle config changed from `path.join(__dirname, ...)` to relative `"./src/schema/index.ts"` for Windows compatibility

## Next Steps
1. Install Redis locally or use a cloud Redis instance
2. Configure Stripe webhooks for payment flows
3. Set up Twilio for SMS/call functionality
4. Run the web dashboard (`cd artifacts/web && pnpm run dev`)
