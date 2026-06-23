import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSubscriptionColumns1746292000000 implements MigrationInterface {
  name = 'AddSubscriptionColumns1746292000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');

    const expiresCol = table?.findColumnByName('subscription_expires_at');
    if (!expiresCol) {
      await queryRunner.addColumn('users', new TableColumn({
        name: 'subscription_expires_at',
        type: 'timestamptz',
        isNullable: true,
      }));
    }

    const txCol = table?.findColumnByName('subscription_apple_original_transaction_id');
    if (!txCol) {
      await queryRunner.addColumn('users', new TableColumn({
        name: 'subscription_apple_original_transaction_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    const expiresCol = table?.findColumnByName('subscription_expires_at');
    const txCol = table?.findColumnByName('subscription_apple_original_transaction_id');
    if (expiresCol) await queryRunner.dropColumn('users', 'subscription_expires_at');
    if (txCol) await queryRunner.dropColumn('users', 'subscription_apple_original_transaction_id');
  }
}
