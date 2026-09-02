import { MigrationInterface, QueryRunner } from 'typeorm';

export class ComplianceColumnsAddition1746284700000 implements MigrationInterface {
  name = 'ComplianceColumnsAddition1746284700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Biometric consent (Texas BUIA)
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "biometric_consent_given" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "biometric_consent_at" timestamptz
    `);

    // Tax compliance (IRS 1099-K)
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ytd_gross_volume" decimal(10,2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "w9_on_file" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "w9_submitted_at" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tax_blocked" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tax_notification_5k_sent" boolean NOT NULL DEFAULT false
    `);

    // Profile compliance fields
    await queryRunner.query(`
      ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "category_assignment_reason" text
    `);
    await queryRunner.query(`
      ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "category_manually_overridden" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "insurance_verified" boolean NOT NULL DEFAULT false
    `);

    // Audit events table for FCRA compliance
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid,
        "action" varchar(100) NOT NULL,
        "entity_type" varchar(50) NOT NULL,
        "entity_id" varchar(255),
        "details" jsonb,
        "ip_address" varchar(45),
        "user_agent" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_events" PRIMARY KEY ("id")
      )
    `);

    // Data deletion requests table (CCPA)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "data_deletion_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "requested_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz,
        "completed_by" uuid,
        "notes" text,
        CONSTRAINT "PK_data_deletion_requests" PRIMARY KEY ("id")
      )
    `);

    // Missing columns from initial schema
    await queryRunner.query(`
      ALTER TABLE "sos_events" ADD COLUMN IF NOT EXISTS "noonlight_alarm_id" varchar(100)
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "safe_word" varchar(50)
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "share_token" varchar(20)
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "last_known_location" geometry
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "last_ping_at" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "mapbox_route_polyline" text
    `);
    await queryRunner.query(`
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "expected_arrival_time" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "origin_lat" float
    `);
    await queryRunner.query(`
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "origin_lng" float
    `);
    await queryRunner.query(`
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "dest_lat" float
    `);
    await queryRunner.query(`
      ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "dest_lng" float
    `);
    await queryRunner.query(`
      ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "display_name" varchar(100)
    `);

    // Deviation events table (safety)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "deviation_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "actual_location" geometry,
        "expected_location" geometry,
        "deviation_distance_miles" float NOT NULL DEFAULT 0,
        "time_off_route_seconds" int,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "responded_at" timestamptz,
        "response" text,
        "ts_paged_at" timestamptz,
        "contacts_notified_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_deviation_events" PRIMARY KEY ("id")
      )
    `);

    // Appeals table (trust & safety)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "appeals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "action_id" uuid NOT NULL,
        "reason" varchar(2000) NOT NULL,
        "evidence_url" varchar(255),
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "reviewed_by" uuid,
        "decision" varchar(500),
        "reviewed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_appeals" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "appeals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "deviation_events"`);
    await queryRunner.query(
      `ALTER TABLE "profiles" DROP COLUMN IF EXISTS "display_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP COLUMN IF EXISTS "dest_lng"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP COLUMN IF EXISTS "dest_lat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP COLUMN IF EXISTS "origin_lng"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP COLUMN IF EXISTS "origin_lat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP COLUMN IF EXISTS "expected_arrival_time"`,
    );
    await queryRunner.query(
      `ALTER TABLE "trips" DROP COLUMN IF EXISTS "mapbox_route_polyline"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN IF EXISTS "last_ping_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN IF EXISTS "last_known_location"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP COLUMN IF EXISTS "share_token"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "safe_word"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sos_events" DROP COLUMN IF EXISTS "noonlight_alarm_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "data_deletion_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events"`);
    await queryRunner.query(
      `ALTER TABLE "profiles" DROP COLUMN IF EXISTS "insurance_verified"`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" DROP COLUMN IF EXISTS "category_manually_overridden"`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" DROP COLUMN IF EXISTS "category_assignment_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "tax_notification_5k_sent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "tax_blocked"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "w9_submitted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "w9_on_file"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "ytd_gross_volume"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "biometric_consent_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "biometric_consent_given"`,
    );
  }
}
