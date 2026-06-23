import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLuggageInsuranceColumn1746400000000 implements MigrationInterface {
  name = 'AddLuggageInsuranceColumn1746400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('bookings');

    const col = table?.findColumnByName('luggage_insurance_opted_in');
    if (!col) {
      await queryRunner.addColumn('bookings', new TableColumn({
        name: 'luggage_insurance_opted_in',
        type: 'boolean',
        default: false,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('bookings');
    const col = table?.findColumnByName('luggage_insurance_opted_in');
    if (col) await queryRunner.dropColumn('bookings', 'luggage_insurance_opted_in');
  }
}