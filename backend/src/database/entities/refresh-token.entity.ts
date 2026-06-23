import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ unique: true })
  token!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: string;

  @Column({ default: false })
  is_revoked!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  revoked_reason!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  device_info!: string | null;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;
}
