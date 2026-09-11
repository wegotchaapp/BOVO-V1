# API contract change log

Binding on **both** agents. No change to a response shape consumed by
`mobile/artifacts/mobile/lib/*.ts` lands without a row here first.
See `AGENT_OPERATING_AGREEMENT.md` §6.2.

| Date | Route | Old shape | New shape | Client change required | Client updated |
| --- | --- | --- | --- | --- | --- |
| 2026-09-11 | `POST /api/trips/:id/replies` | `{ reply }` | Always `403 { error }` — replies on posts are off | Stop calling it; remove the reply UI | ☐ |
| 2026-09-11 | `GET /api/trips/:id` | `replies: TripReply[]`, `trip.replyCount: n` | `replies: []` and `replyCount: 0`, always. Field shapes unchanged | Remove the public questions section | ☐ |
| 2026-09-11 | `GET /api/trips` (with or without `date`) | Every `active` trip, including ones whose departure has passed | Only trips departing after now | None — fewer rows | ☐ |
| 2026-09-11 | `POST /api/vehicles` | Upsert of the Voyager's single vehicle | Always creates a vehicle. `400` at 5 vehicles or a VIN already on the account | Call it from "Add vehicle" only | ☐ |
| 2026-09-11 | `PUT /api/vehicles/:id` (new) | — | Same body as `POST`, returns `{ vehicle }`. `403` when the vehicle is approved. A rejected vehicle that is complete again returns to `pending_review` | The edit flow uses it | ☐ |
| 2026-09-11 | `POST /api/vehicles/photo` and `/document` → `POST /api/vehicles/:id/photo` and `/:id/document` | Applied to the most recently updated vehicle | Applied to `:id`; `403` when approved. Old paths removed | Pass the vehicle id | ☐ |
| 2026-09-11 | `POST /api/trips` | Car taken from the most recently updated vehicle | Optional `vehicleId`: must be the caller's approved vehicle. Omitted: newest approved vehicle | Post screen sends `vehicleId` | ☐ |
| 2026-09-11 | `GET /api/identity/verification` (new) | — | `{ verification: { id, status, documentType, submittedAt, reviewedAt, reviewNote } \| null }`, latest submission | New Settings screen | ☐ |
| 2026-09-11 | `POST /api/identity/verification` (new, multipart) | — | Fields `documentType` (`drivers_license` \| `state_id` \| `passport`); files `idFront`, `idBack` (required unless passport), `selfie`. Returns `{ verification }`. `409` when a submission is pending or already approved | New Settings screen | ☐ |

## Client modules under contract

`api.ts` · `bookings.ts` · `conversations.ts` · `groups.ts` · `odometer.ts` ·
`preferences.ts` · `pricing.ts` · `ratings.ts` · `safety.ts` · `tracking.ts` ·
`trips.ts` · `vehicles.ts`

A row is complete only when **client updated** is checked. An unchecked row is
an open break in the app.
