import { MigrationInterface, QueryRunner } from 'typeorm';

export class PasswordHashNullable1746286000000 implements MigrationInterface {
  name = 'PasswordHashNullable1746286000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL
    `);
  }
}
