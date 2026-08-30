import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replays the verified production vehicle and Checkr schema on installations
 * that begin from the TypeORM migration history rather than the manual SQL
 * rollout. The source of truth is migrations-applied/vehicle_migration.sql.
 */
export class MobileVehicleAndBackgroundCheck1788048000000 implements MigrationInterface {
  name = 'MobileVehicleAndBackgroundCheck1788048000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "mobile_vehicles"
        ADD COLUMN IF NOT EXISTS "seat_count" integer,
        ADD COLUMN IF NOT EXISTS "door_count" integer,
        ADD COLUMN IF NOT EXISTS "photo_front_url" text,
        ADD COLUMN IF NOT EXISTS "photo_rear_url" text,
        ADD COLUMN IF NOT EXISTS "photo_left_url" text,
        ADD COLUMN IF NOT EXISTS "photo_right_url" text,
        ADD COLUMN IF NOT EXISTS "photo_interior_url" text,
        ADD COLUMN IF NOT EXISTS "insurance_doc_url" text,
        ADD COLUMN IF NOT EXISTS "insurance_expires_at" date,
        ADD COLUMN IF NOT EXISTS "registration_doc_url" text,
        ADD COLUMN IF NOT EXISTS "registration_expires_at" date,
        ADD COLUMN IF NOT EXISTS "verification_status" varchar(16) NOT NULL DEFAULT 'incomplete',
        ADD COLUMN IF NOT EXISTS "verification_note" text;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'mobile_vehicles' AND column_name = 'vin'
            AND character_maximum_length IS DISTINCT FROM 17
        ) THEN
          UPDATE "mobile_vehicles"
          SET "vin" = NULL
          WHERE "vin" IS NOT NULL AND "vin" !~ '^[A-HJ-NPR-Z0-9]{17}$';
          ALTER TABLE "mobile_vehicles" ALTER COLUMN "vin" TYPE varchar(17);
        END IF;
      END $$;
    `);
    await queryRunner.query(`
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
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_mobile_vehicles_vin"
      ON "mobile_vehicles" ("vin") WHERE "vin" IS NOT NULL;
    `);
    await queryRunner.query(`
      UPDATE "mobile_vehicles" SET "verification_status" = 'incomplete'
      WHERE "verification_status" IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "mobile_users"
        ADD COLUMN IF NOT EXISTS "checkr_candidate_id" varchar(64),
        ADD COLUMN IF NOT EXISTS "background_check_status" varchar(24) NOT NULL DEFAULT 'not_started',
        ADD COLUMN IF NOT EXISTS "ssn_verified" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "ssn_last4" varchar(4),
        ADD COLUMN IF NOT EXISTS "background_check_completed_at" timestamptz;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_mobile_users_checkr_candidate"
      ON "mobile_users" ("checkr_candidate_id") WHERE "checkr_candidate_id" IS NOT NULL;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_users_bg_status') THEN
          ALTER TABLE "mobile_users"
          ADD CONSTRAINT "CHK_mobile_users_bg_status"
          CHECK ("background_check_status" IN
            ('not_started','invitation_sent','pending','clear','consider','suspended'));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CHK_mobile_users_ssn_last4') THEN
          ALTER TABLE "mobile_users"
          ADD CONSTRAINT "CHK_mobile_users_ssn_last4"
          CHECK ("ssn_last4" IS NULL OR "ssn_last4" ~ '^[0-9]{4}$');
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mobile_users" DROP CONSTRAINT IF EXISTS "CHK_mobile_users_ssn_last4";`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobile_users" DROP CONSTRAINT IF EXISTS "CHK_mobile_users_bg_status";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_mobile_users_checkr_candidate";`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobile_users" DROP COLUMN IF EXISTS "background_check_completed_at", DROP COLUMN IF EXISTS "ssn_last4", DROP COLUMN IF EXISTS "ssn_verified", DROP COLUMN IF EXISTS "background_check_status", DROP COLUMN IF EXISTS "checkr_candidate_id";`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_mobile_vehicles_vin";`);
    await queryRunner.query(
      `ALTER TABLE "mobile_vehicles" DROP CONSTRAINT IF EXISTS "CHK_mobile_vehicles_counts";`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobile_vehicles" DROP CONSTRAINT IF EXISTS "CHK_mobile_vehicles_status";`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobile_vehicles" DROP COLUMN IF EXISTS "verification_note", DROP COLUMN IF EXISTS "verification_status", DROP COLUMN IF EXISTS "registration_expires_at", DROP COLUMN IF EXISTS "registration_doc_url", DROP COLUMN IF EXISTS "insurance_expires_at", DROP COLUMN IF EXISTS "insurance_doc_url", DROP COLUMN IF EXISTS "photo_interior_url", DROP COLUMN IF EXISTS "photo_right_url", DROP COLUMN IF EXISTS "photo_left_url", DROP COLUMN IF EXISTS "photo_rear_url", DROP COLUMN IF EXISTS "photo_front_url", DROP COLUMN IF EXISTS "door_count", DROP COLUMN IF EXISTS "seat_count";`,
    );
  }
}
