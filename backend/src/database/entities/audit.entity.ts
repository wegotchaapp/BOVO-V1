import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('audit_events', { synchronize: false })
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Keep the API property names while mapping the migration-built audit schema.
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  actor_id!: string | null;

  @Column({ type: 'varchar', length: 50 })
  entity_type!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  entity_id!: string | null;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column('jsonb', { name: 'details', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: string;
}
