import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The original mobile baseline migration omitted these entity-backed tables.
 * They existed only because earlier environments used DATABASE_SYNCHRONIZE.
 * This migration makes a clean TypeORM-only bootstrap possible before the
 * later vehicle, safety, and odometer migrations run.
 */
export class MobileApiRemainingBaseTables1788047999000 implements MigrationInterface {
  name = 'MobileApiRemainingBaseTables1788047999000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_vehicles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "make" varchar(60) NOT NULL,
        "model" varchar(60) NOT NULL,
        "year" integer NOT NULL,
        "color" varchar(40) NOT NULL,
        "license_plate" varchar(20) NOT NULL,
        "state" varchar(2) NOT NULL DEFAULT 'TX',
        "vin" varchar(17),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_vehicles_user" ON "mobile_vehicles" ("user_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_ratings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "booking_id" uuid NOT NULL,
        "rater_id" uuid NOT NULL,
        "ratee_id" uuid NOT NULL,
        "score" integer NOT NULL,
        "comment" text,
        "tags" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_mobile_ratings_booking_rater" UNIQUE ("booking_id", "rater_id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_ratings_booking" ON "mobile_ratings" ("booking_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_ratings_rater" ON "mobile_ratings" ("rater_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_ratings_ratee" ON "mobile_ratings" ("ratee_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_conversations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_low_id" uuid NOT NULL,
        "user_high_id" uuid NOT NULL,
        "last_message" text,
        "last_message_at" timestamptz,
        "trip_label" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_mobile_conversations_users" UNIQUE ("user_low_id", "user_high_id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_conversations_low" ON "mobile_conversations" ("user_low_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_conversations_high" ON "mobile_conversations" ("user_high_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_direct_messages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "sender_id" uuid NOT NULL,
        "text" text NOT NULL,
        "read_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_direct_messages_conversation" ON "mobile_direct_messages" ("conversation_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_direct_messages_sender" ON "mobile_direct_messages" ("sender_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_live_locations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "trip_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" varchar(12) NOT NULL,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "heading" double precision,
        "speed" double precision,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_mobile_live_locations_trip_user" UNIQUE ("trip_id", "user_id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_live_locations_trip" ON "mobile_live_locations" ("trip_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_live_locations_user" ON "mobile_live_locations" ("user_id");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_live_locations";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_direct_messages";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_conversations";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_ratings";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_vehicles";`);
  }
}
