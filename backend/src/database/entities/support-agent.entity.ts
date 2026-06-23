import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('support_agents')
export class SupportAgent {
  @PrimaryColumn({ length: 32 })
  id!: string;

  @Column('text')
  name!: string;

  @Column('text', { unique: true })
  email!: string;

  @Column('text')
  password_hash!: string;

  @Column('text', { default: 'agent' })
  role!: string;

  @Column('boolean', { default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
