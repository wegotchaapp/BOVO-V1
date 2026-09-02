import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Completes columns present in the mobile entities but absent from the original
 * mobile baseline. These columns previously appeared only via local schema
 * synchronization, so they must be explicit before later migrations run.
 */
export class MobileApiEntityColumns1788047999500 implements MigrationInterface {
  name = 'MobileApiEntityColumns1788047999500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "mobile_users"
        ADD COLUMN IF NOT EXISTS "bio" text,
        ADD COLUMN IF NOT EXISTS "languages" text,
        ADD COLUMN IF NOT EXISTS "emergency_name" varchar(120),
        ADD COLUMN IF NOT EXISTS "emergency_phone" varchar(32),
        ADD COLUMN IF NOT EXISTS "photo_url" text,
        ADD COLUMN IF NOT EXISTS "ride_preferences" text,
        ADD COLUMN IF NOT EXISTS "notification_settings" text,
        ADD COLUMN IF NOT EXISTS "oauth_provider" varchar(20),
        ADD COLUMN IF NOT EXISTS "oauth_subject" varchar(128),
        ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamptz;
    `);
    await queryRunner.query(`
      ALTER TABLE "mobile_trips"
        ADD COLUMN IF NOT EXISTS "start_video_url" text,
        ADD COLUMN IF NOT EXISTS "started_at" timestamptz;
    `);
    await queryRunner.query(`
      ALTER TABLE "mobile_bookings"
        ADD COLUMN IF NOT EXISTS "payment_intent_id" varchar(64);
    `);
    await queryRunner.query(`
      ALTER TABLE "mobile_bookings"
      ALTER COLUMN "status" SET DEFAULT 'pending';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mobile_bookings" ALTER COLUMN "status" SET DEFAULT 'confirmed';`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobile_bookings" DROP COLUMN IF EXISTS "payment_intent_id";`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobile_trips" DROP COLUMN IF EXISTS "started_at", DROP COLUMN IF EXISTS "start_video_url";`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobile_users" DROP COLUMN IF EXISTS "deletion_requested_at", DROP COLUMN IF EXISTS "oauth_subject", DROP COLUMN IF EXISTS "oauth_provider", DROP COLUMN IF EXISTS "notification_settings", DROP COLUMN IF EXISTS "ride_preferences", DROP COLUMN IF EXISTS "photo_url", DROP COLUMN IF EXISTS "emergency_phone", DROP COLUMN IF EXISTS "emergency_name", DROP COLUMN IF EXISTS "languages", DROP COLUMN IF EXISTS "bio";`,
    );
  }
}
