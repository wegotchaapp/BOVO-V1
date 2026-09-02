import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { VerificationStatus, BackgroundCheckStatus } from '../../common/enums';
import { User } from './user.entity';

@Entity('verifications')
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ default: 'stripe_identity' })
  provider!: string;

  @Column({ unique: true })
  provider_reference!: string;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status!: VerificationStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verified_name!: string | null;

  @Column({ type: 'date', nullable: true })
  verified_dob!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  face_image_reference!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at!: string | null;

  @CreateDateColumn()
  created_at!: string;
}

@Entity('background_checks')
export class BackgroundCheck {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ unique: true })
  checkr_candidate_id!: string;

  @Column({
    type: 'enum',
    enum: BackgroundCheckStatus,
    default: BackgroundCheckStatus.PENDING,
  })
  status!: BackgroundCheckStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  checkr_package!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  invitation_url!: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  ssn_hash_suffix!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fcra_disclosure_accepted_at!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  user_authorization_accepted_at!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  initiated_at!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  pre_adverse_notice_sent_at!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  final_adverse_notice_sent_at!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  adverse_action_deadline!: string | null;

  @Column({ default: false })
  annual_recheck_scheduled!: boolean;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;
}
