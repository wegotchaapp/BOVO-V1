import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('user_sessions')
export class UserSession {
  @PrimaryColumn({ length: 64 })
  id!: string;

  @Column({ length: 32 })
  user_id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @Column('timestamptz')
  expires_at!: Date;
}
