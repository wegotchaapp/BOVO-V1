import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFoundingMemberColumn1746291000000 implements MigrationInterface {
  name = 'AddFoundingMemberColumn1746291000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    const col = table?.findColumnByName('is_founding_member');
    if (!col) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'is_founding_member',
          type: 'boolean',
          default: false,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');
    const col = table?.findColumnByName('is_founding_member');
    if (col) {
      await queryRunner.dropColumn('users', 'is_founding_member');
    }
  }
}
