import { MigrationInterface, QueryRunner } from 'typeorm';

export class SelectedRoleColumnAddition1746285000000 implements MigrationInterface {
  name = 'SelectedRoleColumnAddition1746285000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "selected_role" character varying(10) NOT NULL DEFAULT 'rider'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "selected_role"
    `);
  }
}
