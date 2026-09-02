import { MigrationInterface, QueryRunner } from 'typeorm';

/** Replays the verified luggage, insurance, and odometer schema. */
export class MobileBookingLuggageAndOdometer1788048001000 implements MigrationInterface {
  name = 'MobileBookingLuggageAndOdometer1788048001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "mobile_bookings"
        ADD COLUMN IF NOT EXISTS "luggage_tier" varchar(12) NOT NULL DEFAULT 'carry_on',
        ADD COLUMN IF NOT EXISTS "luggage_surcharge" numeric(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "insurance_opted_in" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "insurance_premium" numeric(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "luggage_insurance_opted_in" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "luggage_insurance_premium" numeric(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "pickup_miles" integer,
        ADD COLUMN IF NOT EXISTS "dropoff_miles" integer,
        ADD COLUMN IF NOT EXISTS "miles_travelled" integer,
        ADD COLUMN IF NOT EXISTS "picked_up_at" timestamptz,
        ADD COLUMN IF NOT EXISTS "dropped_off_at" timestamptz;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_bookings_luggage_tier') THEN
          ALTER TABLE "mobile_bookings" ADD CONSTRAINT "CHK_mobile_bookings_luggage_tier"
          CHECK ("luggage_tier" IN ('carry_on', 'standard', 'large', 'oversized'));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_bookings_amounts_nonneg') THEN
          ALTER TABLE "mobile_bookings" ADD CONSTRAINT "CHK_mobile_bookings_amounts_nonneg"
          CHECK ("luggage_surcharge" >= 0 AND "insurance_premium" >= 0 AND "luggage_insurance_premium" >= 0);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_bookings_miles_order') THEN
          ALTER TABLE "mobile_bookings" ADD CONSTRAINT "CHK_mobile_bookings_miles_order"
          CHECK ("pickup_miles" IS NULL OR "dropoff_miles" IS NULL OR "dropoff_miles" >= "pickup_miles");
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_odometer_readings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "trip_id" uuid NOT NULL,
        "booking_id" uuid NOT NULL,
        "sailor_id" uuid NOT NULL,
        "voyager_id" uuid NOT NULL,
        "kind" varchar(8) NOT NULL,
        "miles" integer NOT NULL,
        "photo_url" text NOT NULL,
        "latitude" numeric(9,6),
        "longitude" numeric(9,6),
        "recorded_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_mobile_odometer_booking_kind" ON "mobile_odometer_readings" ("booking_id", "kind");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_odometer_trip_recorded" ON "mobile_odometer_readings" ("trip_id", "recorded_at");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_odometer_trip" ON "mobile_odometer_readings" ("trip_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_odometer_booking" ON "mobile_odometer_readings" ("booking_id");`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_odometer_kind') THEN
          ALTER TABLE "mobile_odometer_readings" ADD CONSTRAINT "CHK_mobile_odometer_kind"
          CHECK ("kind" IN ('pickup', 'dropoff'));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_odometer_miles_nonneg') THEN
          ALTER TABLE "mobile_odometer_readings" ADD CONSTRAINT "CHK_mobile_odometer_miles_nonneg"
          CHECK ("miles" >= 0);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_odometer_readings";`);
    await queryRunner.query(
      `ALTER TABLE "mobile_bookings" DROP CONSTRAINT IF EXISTS "CHK_mobile_bookings_miles_order";`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobile_bookings" DROP CONSTRAINT IF EXISTS "CHK_mobile_bookings_amounts_nonneg";`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobile_bookings" DROP CONSTRAINT IF EXISTS "CHK_mobile_bookings_luggage_tier";`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobile_bookings" DROP COLUMN IF EXISTS "dropped_off_at", DROP COLUMN IF EXISTS "picked_up_at", DROP COLUMN IF EXISTS "miles_travelled", DROP COLUMN IF EXISTS "dropoff_miles", DROP COLUMN IF EXISTS "pickup_miles", DROP COLUMN IF EXISTS "luggage_insurance_premium", DROP COLUMN IF EXISTS "luggage_insurance_opted_in", DROP COLUMN IF EXISTS "insurance_premium", DROP COLUMN IF EXISTS "insurance_opted_in", DROP COLUMN IF EXISTS "luggage_surcharge", DROP COLUMN IF EXISTS "luggage_tier";`,
    );
  }
}
