import { MigrationInterface, QueryRunner } from 'typeorm';

/** Replays the mobile SOS, route geometry, and deviation-event schema. */
export class MobileSafetyAndRouteDeviation1788048002000 implements MigrationInterface {
  name = 'MobileSafetyAndRouteDeviation1788048002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_sos_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "mobile_users"("id") ON DELETE CASCADE,
        "trip_id" uuid,
        "status" varchar(20) NOT NULL DEFAULT 'active',
        "latitude" double precision,
        "longitude" double precision,
        "noonlight_alarm_id" varchar(100),
        "contact_notified" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_mobile_sos_events_user" ON "mobile_sos_events" ("user_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_mobile_sos_events_trip" ON "mobile_sos_events" ("trip_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_mobile_sos_events_alarm" ON "mobile_sos_events" ("noonlight_alarm_id");`,
    );

    await queryRunner.query(`
      ALTER TABLE "mobile_trips"
      ADD COLUMN IF NOT EXISTS "route_polyline" text,
      ADD COLUMN IF NOT EXISTS "route_fetched_at" timestamptz;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_deviation_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "trip_id" uuid NOT NULL REFERENCES "mobile_trips"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "mobile_users"("id") ON DELETE CASCADE,
        "latitude" double precision NOT NULL,
        "longitude" double precision NOT NULL,
        "distance_miles" double precision NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_mobile_deviation_trip" ON "mobile_deviation_events" ("trip_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_mobile_deviation_user" ON "mobile_deviation_events" ("user_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_mobile_deviation_recent" ON "mobile_deviation_events" ("trip_id", "created_at" DESC);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_deviation_events";`);
    await queryRunner.query(
      `ALTER TABLE "mobile_trips" DROP COLUMN IF EXISTS "route_fetched_at", DROP COLUMN IF EXISTS "route_polyline";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "mobile_sos_events";`);
  }
}
