import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the isolated `mobile_*` tables that back the Bovogo mobile app's
 * `/api/*` contract. Purely additive — does not touch the platform's primary
 * schema. UUID primary keys default to uuid_generate_v4().
 */
export class MobileApiTables1746600000000 implements MigrationInterface {
  name = 'MobileApiTables1746600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "email" varchar NOT NULL,
        "phone" varchar(32),
        "password_hash" varchar NOT NULL,
        "role" varchar(12),
        "rating" numeric(3,2) NOT NULL DEFAULT 5,
        "trips" integer NOT NULL DEFAULT 0,
        "is_verified" boolean NOT NULL DEFAULT false,
        "onboarded" boolean NOT NULL DEFAULT false,
        "is_founding_member" boolean NOT NULL DEFAULT false,
        "stripe_customer_id" varchar(100),
        "stripe_subscription_id" varchar(100),
        "subscription_status" varchar(30),
        "trial_ends_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_mobile_users_email" ON "mobile_users" ("email");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_sessions" (
        "token" varchar(64) PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_sessions_user" ON "mobile_sessions" ("user_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_trips" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "driver_id" uuid NOT NULL,
        "from_city" text NOT NULL,
        "to_city" text NOT NULL,
        "departure_at" timestamptz NOT NULL,
        "seats_available" integer NOT NULL,
        "luggage_space" integer NOT NULL DEFAULT 0,
        "price_per_seat" numeric(10,2) NOT NULL,
        "note" text NOT NULL DEFAULT '',
        "car" text,
        "pref_smoking" boolean NOT NULL DEFAULT false,
        "pref_pets" boolean NOT NULL DEFAULT false,
        "pref_music" boolean NOT NULL DEFAULT true,
        "pref_ac" boolean NOT NULL DEFAULT true,
        "status" varchar(12) NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_trips_driver" ON "mobile_trips" ("driver_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_trip_replies" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "trip_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "text" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_trip_replies_trip" ON "mobile_trip_replies" ("trip_id","created_at");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_trip_reply_reads" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "trip_id" uuid NOT NULL,
        "last_read_at" timestamptz NOT NULL,
        CONSTRAINT "UQ_mobile_reply_reads_user_trip" UNIQUE ("user_id","trip_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_bookings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "trip_id" uuid NOT NULL,
        "rider_id" uuid NOT NULL,
        "seats" integer NOT NULL,
        "price_per_seat" numeric(10,2) NOT NULL,
        "service_fee" numeric(10,2) NOT NULL,
        "total_amount" numeric(10,2) NOT NULL,
        "payment_method" varchar(12) NOT NULL,
        "status" varchar(12) NOT NULL DEFAULT 'confirmed',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_bookings_trip" ON "mobile_bookings" ("trip_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_bookings_rider" ON "mobile_bookings" ("rider_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_trip_groups" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "trip_id" uuid NOT NULL,
        "pickup_hub_id" text,
        "pickup_locked" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_mobile_trip_groups_trip" UNIQUE ("trip_id")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_trip_group_members" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "group_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" varchar(12) NOT NULL,
        "joined_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_mobile_group_members" UNIQUE ("group_id","user_id")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_group_members_user" ON "mobile_trip_group_members" ("user_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_trip_group_messages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "group_id" uuid NOT NULL,
        "sender_id" uuid,
        "text" text NOT NULL,
        "is_system" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_group_messages_group" ON "mobile_trip_group_messages" ("group_id","created_at");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_driver_trips" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "driver_id" uuid NOT NULL,
        "from_city" text NOT NULL,
        "to_city" text NOT NULL,
        "miles" integer NOT NULL,
        "seats_booked" integer NOT NULL,
        "gross_amount" numeric(10,2) NOT NULL,
        "platform_fee" numeric(10,2) NOT NULL,
        "net_amount" numeric(10,2) NOT NULL,
        "completed_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_driver_trips_driver" ON "mobile_driver_trips" ("driver_id","completed_at");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_driver_trips";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_trip_group_messages";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_trip_group_members";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_trip_groups";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_bookings";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_trip_reply_reads";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_trip_replies";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_trips";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_sessions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_users";`);
  }
}
