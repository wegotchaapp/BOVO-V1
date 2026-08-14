-- Bovogo — item 14: odometer capture + per-Sailor mileage.
-- APPLIED to Supabase 2026-08-14. Additive and re-runnable.

BEGIN;

-- ── mobile_bookings: the Sailor's verified journey ───────────────────────────
ALTER TABLE "mobile_bookings"
  ADD COLUMN IF NOT EXISTS "pickup_miles"    integer,
  ADD COLUMN IF NOT EXISTS "dropoff_miles"   integer,
  ADD COLUMN IF NOT EXISTS "miles_travelled" integer,
  ADD COLUMN IF NOT EXISTS "picked_up_at"    timestamptz,
  ADD COLUMN IF NOT EXISTS "dropped_off_at"  timestamptz;

-- ── mobile_odometer_readings: append-only evidence trail ─────────────────────
CREATE TABLE IF NOT EXISTS "mobile_odometer_readings" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "trip_id"     uuid        NOT NULL,
  "booking_id"  uuid        NOT NULL,
  "sailor_id"   uuid        NOT NULL,
  "voyager_id"  uuid        NOT NULL,
  "kind"        varchar(8)  NOT NULL,
  "miles"       integer     NOT NULL,
  "photo_url"   text        NOT NULL,
  "latitude"    numeric(9,6),
  "longitude"   numeric(9,6),
  "recorded_at" timestamptz NOT NULL,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);

-- One pickup and one dropoff per booking. Corrections are new readings, never
-- edits — this uniqueness is what keeps the audit trail honest.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_mobile_odometer_booking_kind"
  ON "mobile_odometer_readings" ("booking_id", "kind");

CREATE INDEX IF NOT EXISTS "IDX_mobile_odometer_trip_recorded"
  ON "mobile_odometer_readings" ("trip_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "IDX_mobile_odometer_trip"
  ON "mobile_odometer_readings" ("trip_id");
CREATE INDEX IF NOT EXISTS "IDX_mobile_odometer_booking"
  ON "mobile_odometer_readings" ("booking_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_odometer_kind') THEN
    ALTER TABLE "mobile_odometer_readings"
      ADD CONSTRAINT "CHK_mobile_odometer_kind"
      CHECK ("kind" IN ('pickup', 'dropoff'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_odometer_miles_nonneg') THEN
    ALTER TABLE "mobile_odometer_readings"
      ADD CONSTRAINT "CHK_mobile_odometer_miles_nonneg"
      CHECK ("miles" >= 0);
  END IF;
  -- A dropoff can never be behind its pickup.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_bookings_miles_order') THEN
    ALTER TABLE "mobile_bookings"
      ADD CONSTRAINT "CHK_mobile_bookings_miles_order"
      CHECK (
        "pickup_miles" IS NULL OR "dropoff_miles" IS NULL
        OR "dropoff_miles" >= "pickup_miles"
      );
  END IF;
END $$;

COMMIT;
