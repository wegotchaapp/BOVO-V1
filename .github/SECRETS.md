# Required GitHub Secrets

## Backend (.env)
| Secret | Description | Example |
|--------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/wegotcha` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret | `your-super-secret-jwt-key-min-32-chars` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_test_...` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | `AC_...` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | `your-auth-token` |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | `+15551234567` |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio verify SID | `VA_...` |
| `RESEND_API_KEY` | Resend email API key | `re_...` |
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIA_...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `your-aws-secret` |
| `SENTRY_DSN` | Sentry DSN | `https://...@sentry.io/...` |
| `SENTRY_AUTH_TOKEN` | Sentry auth token | `sntrys_...` |
| `SENTRY_ORG` | Sentry organization | `your-org-name` |
| `APP_URL` | Production API URL | `https://api.wegotcha.com` |

## Mobile (.env)
| Secret | Description | Example |
|--------|-------------|---------|
| `EXPO_TOKEN` | Expo EAS build token | `your-expo-token` |
| `EXPO_PUBLIC_API_URL` | Backend API URL | `https://api.wegotcha.com` |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `your-anon-key` |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox access token | `pk.your-mapbox-token` |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_test_...` |
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN for mobile | `https://...@sentry.io/...` |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | PostHog API key | `phc_...` |
| `EXPO_CREDENTIALS_JSON` | Expo credentials for signing | `{...}` |

## Deployment
| Secret | Description | Example |
|--------|-------------|---------|
| `RAILWAY_TOKEN` | Railway deployment token | `rwy_...` |
| `RAILWAY_SERVICE_ID` | Railway service ID | `your-service-id` |
