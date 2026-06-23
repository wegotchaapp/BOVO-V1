import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('compliance_logs')
export class ComplianceLog {
  @PrimaryColumn({ length: 32 })
  id!: string;

  @Column({ length: 32 })
  user_id!: string;

  @Column('varchar')
  rule!: string;

  @Column('varchar')
  action!: string;

  @Column('varchar', { length: 500, nullable: true })
  details!: string | null;

  @Column('timestamptz')
  triggered_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
