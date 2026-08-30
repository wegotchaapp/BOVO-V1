# Release checklist

Use this after all P0/P1 items in `PRODUCTION_READINESS.md` are closed.

## 1. Source and automation

- [ ] Main is protected by required backend, mobile, and admin checks.
- [ ] CI paths and working directories point at the current repository layout.
- [ ] Lockfiles are committed and production dependency audits have no unapproved critical or high findings.
- [ ] Backend lint, typecheck, unit tests, integration tests, and build pass.
- [ ] Admin lint, typecheck, build, and API smoke test pass.
- [ ] Mobile workspace typecheck and production Expo export/build pass.

## 2. Data and integrations

- [ ] A clean database can run all TypeORM migrations exactly once.
- [ ] An upgrade copy can run all TypeORM migrations without data loss.
- [ ] Supabase/Postgres connection pooling, TLS, backup, and restore drill are verified.
- [ ] Redis/BullMQ is available and included in readiness checks.
- [ ] Stripe payment, refund, and webhook flows are tested with production-like keys in staging.
- [ ] Checkr and Noonlight webhooks reject invalid signatures and safely handle duplicate events.
- [ ] Vehicle, odometer, and trip evidence are stored privately and can be retrieved only by authorized users.

## 3. User journey smoke test

- [ ] Rider registration, authentication, and account deletion/cancellation.
- [ ] Driver vehicle enrollment, document approval, background-check status, and trip posting.
- [ ] Search, booking, payment confirmation, ticket, group chat, and cancellation/refund.
- [ ] Trip start video, location sharing, odometer pickup/drop-off, earnings, and rating.
- [ ] SOS, emergency contact notification, safety escalation, and webhook update.
- [ ] Admin moderation, vehicle review, compliance logs, and driver earnings pages.

## 4. Launch controls

- [ ] Production origins, secrets, provider webhooks, and EAS credentials are configured outside the repository.
- [ ] Monitoring alerts cover API availability, database pool saturation, Redis, payment failures, webhook failures, and SOS failures.
- [ ] Incident owner, rollback plan, data restore owner, and customer-support escalation are documented.
- [ ] Staged rollout, release owner, and explicit go/no-go approval are recorded.
