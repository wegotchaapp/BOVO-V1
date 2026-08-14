-- Bovogo — item 6: vehicle completeness + Checkr background check.
-- Additive and re-runnable.

BEGIN;

-- ── mobile_vehicles ──────────────────────────────────────────────────────────
ALTER TABLE "mobile_vehicles"
  ADD COLUMN IF NOT EXISTS "seat_count"              integer,
  ADD COLUMN IF NOT EXISTS "door_count"              integer,
  ADD COLUMN IF NOT EXISTS "photo_front_url"         text,
  ADD COLUMN IF NOT EXISTS "photo_rear_url"          text,
  ADD COLUMN IF NOT EXISTS "photo_left_url"          text,
  ADD COLUMN IF NOT EXISTS "photo_right_url"         text,
  ADD COLUMN IF NOT EXISTS "photo_interior_url"      text,
  ADD COLUMN IF NOT EXISTS "insurance_doc_url"       text,
  ADD COLUMN IF NOT EXISTS "insurance_expires_at"    date,
  ADD COLUMN IF NOT EXISTS "registration_doc_url"    text,
  ADD COLUMN IF NOT EXISTS "registration_expires_at" date,
  ADD COLUMN IF NOT EXISTS "verification_status"     varchar(16) NOT NULL DEFAULT 'incomplete',
  ADD COLUMN IF NOT EXISTS "verification_note"       text;

-- VIN is 17 characters; widen/shrink only if the column is not already right.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'mobile_vehicles' AND column_name = 'vin'
       AND character_maximum_length IS DISTINCT FROM 17
  ) THEN
    -- Clear anything that isn't a valid VIN so the narrower type can apply.
    UPDATE "mobile_vehicles"
       SET "vin" = NULL
     WHERE "vin" IS NOT NULL AND "vin" !~ '^[A-HJ-NPR-Z0-9]{17}$';
    ALTER TABLE "mobile_vehicles" ALTER COLUMN "vin" TYPE varchar(17);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_vehicles_status') THEN
    ALTER TABLE "mobile_vehicles"
      ADD CONSTRAINT "CHK_mobile_vehicles_status"
      CHECK ("verification_status" IN ('incomplete','pending_review','approved','rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_vehicles_counts') THEN
    ALTER TABLE "mobile_vehicles"
      ADD CONSTRAINT "CHK_mobile_vehicles_counts"
      CHECK (
        ("seat_count" IS NULL OR ("seat_count" BETWEEN 1 AND 8))
        AND ("door_count" IS NULL OR ("door_count" BETWEEN 2 AND 6))
      );
  END IF;
END $$;

-- One physical car cannot belong to two accounts.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_mobile_vehicles_vin"
  ON "mobile_vehicles" ("vin") WHERE "vin" IS NOT NULL;

-- Anything already stored pre-dates these requirements.
UPDATE "mobile_vehicles" SET "verification_status" = 'incomplete'
 WHERE "verification_status" IS NULL;

-- ── mobile_users: Checkr handles ─────────────────────────────────────────────
-- NOTE: there is deliberately NO column for a full SSN. Checkr collects it in
-- its hosted flow; Bovogo stores only the handle, outcome and last four digits.
ALTER TABLE "mobile_users"
  ADD COLUMN IF NOT EXISTS "checkr_candidate_id"           varchar(64),
  ADD COLUMN IF NOT EXISTS "background_check_status"       varchar(24) NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS "ssn_verified"                  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "ssn_last4"                     varchar(4),
  ADD COLUMN IF NOT EXISTS "background_check_completed_at" timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_mobile_users_checkr_candidate"
  ON "mobile_users" ("checkr_candidate_id") WHERE "checkr_candidate_id" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_users_bg_status') THEN
    ALTER TABLE "mobile_users"
      ADD CONSTRAINT "CHK_mobile_users_bg_status"
      CHECK ("background_check_status" IN
        ('not_started','invitation_sent','pending','clear','consider','suspended'));
  END IF;
  -- Belt and braces: last4 must never hold more than four digits.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_users_ssn_last4') THEN
    ALTER TABLE "mobile_users"
      ADD CONSTRAINT "CHK_mobile_users_ssn_last4"
      CHECK ("ssn_last4" IS NULL OR "ssn_last4" ~ '^[0-9]{4}$');
  END IF;
END $$;

COMMIT;

SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'mobile_vehicles' ORDER BY ordinal_position;
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'mobile_users' AND column_name LIKE '%ssn%' OR
       (table_name = 'mobile_users' AND column_name LIKE '%checkr%');
