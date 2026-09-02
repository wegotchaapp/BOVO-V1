import { MigrationInterface, QueryRunner } from 'typeorm';

/** Durable idempotency keys for signed Checkr background-check callbacks. */
export class MobileCheckrWebhookEvents1788048005000 implements MigrationInterface {
  name = 'MobileCheckrWebhookEvents1788048005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mobile_checkr_webhook_events" (
        "event_id" varchar(64) PRIMARY KEY,
        "candidate_id" varchar(64),
        "event_type" varchar(100) NOT NULL,
        "received_at" timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mobile_checkr_webhook_events_candidate" ON "mobile_checkr_webhook_events" ("candidate_id");`,
    );
    // This is internal webhook metadata, never client-readable through the
    // Supabase Data API. The backend database role continues to write it.
    await queryRunner.query(
      `ALTER TABLE "mobile_checkr_webhook_events" ENABLE ROW LEVEL SECURITY;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "mobile_checkr_webhook_events";`,
    );
  }
}
