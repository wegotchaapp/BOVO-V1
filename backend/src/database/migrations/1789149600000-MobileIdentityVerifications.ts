import { MigrationInterface, QueryRunner } from 'typeorm';

export class MobileIdentityVerifications1789149600000 implements MigrationInterface {
  name = 'MobileIdentityVerifications1789149600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Like mobile_vehicles.user_id, user_id is a plain UUID without an FK.
    // The mobile account purge explicitly deletes submissions and their files.
    await queryRunner.query(`CREATE TABLE "mobile_identity_verifications" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL,
      "status" varchar(16) NOT NULL DEFAULT 'pending_review'
        CHECK ("status" IN ('pending_review', 'approved', 'rejected')),
      "document_type" varchar(20) NOT NULL
        CHECK ("document_type" IN ('drivers_license', 'state_id', 'passport')),
      "id_front_key" text NOT NULL,
      "id_back_key" text,
      "selfie_key" text NOT NULL,
      "review_note" text,
      "reviewed_by" uuid,
      "reviewed_at" timestamptz,
      "submitted_at" timestamptz NOT NULL DEFAULT now(),
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_mobile_identity_user_submitted" ON "mobile_identity_verifications" ("user_id", "submitted_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_mobile_identity_one_pending" ON "mobile_identity_verifications" ("user_id") WHERE "status" = 'pending_review'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mobile_identity_review_queue" ON "mobile_identity_verifications" ("status", "submitted_at" DESC, "id" DESC)`,
    );
    // These keys belong only to the backend. Supabase client roles get no policy.
    // The backend uses the table owner/service role, which bypasses RLS.
    await queryRunner.query(
      `ALTER TABLE "mobile_identity_verifications" ENABLE ROW LEVEL SECURITY`,
    );
    await queryRunner.query(
      `REVOKE ALL ON "mobile_identity_verifications" FROM PUBLIC`,
    );
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON "mobile_identity_verifications" FROM anon;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON "mobile_identity_verifications" FROM authenticated;
      END IF;
    END $$`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "mobile_identity_verifications"`);
  }
}
