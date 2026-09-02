-- Backfill for the vehicle-approval gate and the derived trip.car.
--
-- Both statements are guarded by their WHERE clauses, so re-running is a no-op.
--
--   node test/e2e/../../_run_sql.js migrations-applied/vehicle_review_backfill.sql
-- or paste into the Supabase SQL editor.

-- 1. Grandfather vehicles that were already usable before approval was required.
--
-- Posting used to need only complete documents, so anyone sitting at
-- pending_review could post yesterday and would be locked out today. They are
-- approved here, but the note records that no human actually looked — ops can
-- filter on it and re-review properly.
--
-- `incomplete` is deliberately untouched: those vehicles are genuinely missing
-- paperwork and could not post before either. `rejected` is left alone too.
UPDATE mobile_vehicles
   SET verification_status = 'approved',
       verification_note   = COALESCE(NULLIF(verification_note, ''), 'Approved automatically when the review gate shipped — not yet seen by ops.'),
       updated_at          = now()
 WHERE verification_status = 'pending_review';

-- 2. Fill in the car on adventures that never captured one.
--
-- trip.car used to come only from the client, which never sent it, so every
-- existing adventure has an empty string and Sailors saw "Vehicle" on tracking
-- with nothing to identify at the kerb. Derived the same way the service now
-- does it at creation: colour, make, model.
UPDATE mobile_trips t
   SET car = v.descr
  FROM (
        SELECT DISTINCT ON (user_id)
               user_id,
               btrim(concat_ws(' ', NULLIF(btrim(color), ''), NULLIF(btrim(make), ''), NULLIF(btrim(model), ''))) AS descr
          FROM mobile_vehicles
         ORDER BY user_id, updated_at DESC
       ) v
 WHERE v.user_id = t.driver_id
   AND COALESCE(t.car, '') = ''
   AND v.descr <> '';
