-- Bovogo — task 18: luggage surcharge + trip/luggage insurance on bookings.
-- Additive and re-runnable.

BEGIN;

ALTER TABLE "mobile_bookings"
  ADD COLUMN IF NOT EXISTS "luggage_tier"                varchar(12)   NOT NULL DEFAULT 'carry_on',
  ADD COLUMN IF NOT EXISTS "luggage_surcharge"           numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "insurance_opted_in"          boolean       NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "insurance_premium"           numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "luggage_insurance_opted_in"  boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "luggage_insurance_premium"   numeric(10,2) NOT NULL DEFAULT 0;

-- Only the four declared tiers are valid.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_bookings_luggage_tier'
  ) THEN
    ALTER TABLE "mobile_bookings"
      ADD CONSTRAINT "CHK_mobile_bookings_luggage_tier"
      CHECK ("luggage_tier" IN ('carry_on', 'standard', 'large', 'oversized'));
  END IF;
END $$;

-- Money columns can never be negative.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_bookings_amounts_nonneg'
  ) THEN
    ALTER TABLE "mobile_bookings"
      ADD CONSTRAINT "CHK_mobile_bookings_amounts_nonneg"
      CHECK (
        "luggage_surcharge" >= 0
        AND "insurance_premium" >= 0
        AND "luggage_insurance_premium" >= 0
      );
  END IF;
END $$;

-- Existing rows pre-date insurance, so they must not be marked as covered.
UPDATE "mobile_bookings"
   SET "insurance_opted_in" = false
 WHERE "insurance_premium" = 0
   AND "insurance_opted_in" = true;

COMMIT;

SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_name = 'mobile_bookings'
   AND column_name IN (
     'luggage_tier','luggage_surcharge','insurance_opted_in',
     'insurance_premium','luggage_insurance_opted_in','luggage_insurance_premium'
   )
 ORDER BY column_name;
