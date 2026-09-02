import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the verified mobile read-path indexes. These are regular CREATE INDEX
 * operations, matching the prior rollout: current tables are small and TypeORM
 * wraps migrations in a transaction, so CREATE INDEX CONCURRENTLY is invalid.
 */
export class MobileReadPathIndexes1788048004000 implements MigrationInterface {
  name = 'MobileReadPathIndexes1788048004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_trips_active_departure" ON "mobile_trips" ("departure_at") WHERE "status" = 'active';`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_trips_route_active" ON "mobile_trips" (lower("from_city"), lower("to_city"), "departure_at") WHERE "status" = 'active';`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_trips_driver_departure" ON "mobile_trips" ("driver_id", "departure_at");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_bookings_trip_status" ON "mobile_bookings" ("trip_id", "status");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_bookings_rider_created" ON "mobile_bookings" ("rider_id", "created_at" DESC);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_dm_conversation_created" ON "mobile_direct_messages" ("conversation_id", "created_at");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_conversations_last_message" ON "mobile_conversations" ("last_message_at" DESC NULLS LAST);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_sessions_expires" ON "mobile_sessions" ("expires_at");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_driver_trips_completed" ON "mobile_driver_trips" ("driver_id", "completed_at" DESC);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mobile_driver_trips_completed";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mobile_sessions_expires";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mobile_conversations_last_message";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mobile_dm_conversation_created";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mobile_bookings_rider_created";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mobile_bookings_trip_status";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mobile_trips_driver_departure";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mobile_trips_route_active";`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_mobile_trips_active_departure";`,
    );
  }
}
