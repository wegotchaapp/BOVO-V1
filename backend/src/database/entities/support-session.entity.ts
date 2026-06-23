import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('support_sessions')
export class SupportSession {
  @PrimaryColumn({ length: 64 })
  id!: string;

  @Column({ length: 32 })
  agent_id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @Column('timestamptz')
  expires_at!: Date;
}
