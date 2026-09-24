# Bovogo Supabase credential rotation

Prepared September 24, 2026. No credential has been read, copied, rotated or verified by this work. The reported exposed credential is a database password in Git history. Treat it as compromised until rotation is confirmed.

## Files and configuration locations

- Agreed source checkout: `/Users/Sush/Desktop/bovogo-codex`.
- Backend reads `.env.local` before `.env` relative to its working directory. A stale `.env.local` can override the file you just updated. Neither file was present in that checkout's backend when checked today; do not assume another checkout or Railway has no environment.
- Existing private local file found: `/Users/Sush/Desktop/TheBovogo App/backend/.env`. Its contents were not read or copied. Update its DATABASE_URL if this checkout still connects to the same project. This is a different checkout from the agreed source worktree.
- Backend full template: `backend/.env.example`. It contains development placeholders, not working production credentials.
- The accompanying `.env.example` is a database rotation worksheet only. Do not replace a complete backend environment with this short file. Keep the real file private and ignored by Git, with owner-only permissions (`chmod 600` on macOS/Linux).
- Production backend runtime: Railway service/environment Variables, `DATABASE_URL`.
- Deployment automation: GitHub repository Settings → Secrets and variables → Actions, secret `DATABASE_URL`. Check any environment-level override too. The checked workflow reads this secret for migration/deployment.
- Update other consumers of this same database password: local backend checkouts, backup jobs, database clients and connection pools. Do not paste the password into chat, a PR, an issue, screenshots or command arguments.

## Rotation sequence

1. Open the correct Supabase project and verify the project identity before making a change. Prepare the Railway and GitHub settings pages. Expect a connection interruption and arrange a short maintenance window. Prevent automatic code deployments while rotating so unfinished migrations cannot run accidentally.
2. In Supabase **Database → Settings**, use **Reset database password**. Generate a unique strong password and save it directly in your password manager. This resets the database password; it is not `supabase db reset`, which can destroy schema/data.
3. Open the project's **Connect** dialog and copy the correct connection string. Insert the new password, percent-encoding reserved characters in the password component only. Do not use an online password/URL encoder. Preserve the actual host, username, port and database from Connect; do not invent a pooler hostname.
4. Replace `DATABASE_URL` in every consumer listed above. In GitHub/Railway variable fields paste the URL value without dotenv-style surrounding quotes. In a private dotenv file, a quoted value is appropriate. Do not overwrite unrelated Stripe, Twilio, JWT or other provider values.
5. Apply Railway's variable change and restart/redeploy the **existing approved backend version**, inspecting the planned source revision first. Do not merge this feature branch or run migrations just to test a credential. New settings only take effect in a newly started process; a successful old pooled connection does not prove rotation worked.
6. Verify a fresh authenticated database connection succeeds with the new password using a trusted database client, and a fresh connection with the old password fails. Check the backend health endpoint and a read-only authenticated app flow. Do not print connection strings or query customer records into logs. Recycle your application pools; do not assume a password change terminated every pre-existing session. Investigate unexpected sessions through the provider's incident-response tools.
7. Record completion without the secret: project, time, configuration locations updated, fresh new-password success, old-password failure, backend health and reviewer. If anything fails, repair the new configuration; never restore a known-compromised password.
8. After revocation, investigate access logs and scope of exposure. Remove exposed copies from history/artifacts with a coordinated repository cleanup if needed; rewriting history alone does not revoke a password. Do not force-push a history rewrite without coordinating collaborators.

## Connection mode matters for this app

A persistent backend may use the direct connection when reachable, or the shared **session pooler** for IPv4-only networks. The proposed settlement scheduler uses session-level advisory locks, which are incompatible with transaction pooling. Its final implementation and selected connection mode must be reviewed together before release. Migrations/backups should use a suitable direct connection, and must not be run as part of this credential test. The current workflow reuses DATABASE_URL for migrations; changing connection mode therefore needs deliberate review.

Current backend database TLS config uses `rejectUnauthorized: false`. Password rotation does not fix certificate verification. A verified-CA TLS configuration remains a release blocker; do not claim `sslmode=require` alone proves server identity.

## API keys and JWT keys are separate

Resetting the Postgres password does not rotate Supabase API keys. If a Supabase server secret/service-role key was also exposed, rotate/revoke it using the project's API Keys controls and update its server consumers separately. Legacy `anon`/`service_role` JWT keys are tied to the legacy JWT secret; changing that secret has broader effects. Plan legacy-key migration/rotation using the official documentation and test affected clients before revocation. Never expose a service-role/secret API key in mobile or web client builds.

Bovogo's backend `JWT_SECRET` signs its own application sessions. It is not the Supabase database password or necessarily Supabase's JWT signing secret. Rotate it separately if compromised, accounting for forced session invalidation.

## Sources checked

- [Supabase: reset database password](https://supabase.com/docs/guides/troubleshooting/how-do-i-reset-my-supabase-database-password-oTs5sB)
- [Supabase: connection strings, pooling and TLS](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: API keys and legacy key differences](https://supabase.com/docs/guides/getting-started/api-keys)

The app is not yet cleared for production. Credential rotation, provider configuration, payment/payout validation, remaining security fixes, device testing and Texas operating/legal review are still required.
