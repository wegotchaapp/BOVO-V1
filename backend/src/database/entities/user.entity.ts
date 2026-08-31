import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { UserRole, SubscriptionTier } from '../../common/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  password_hash!: string | null;

  @Column()
  name!: string;

  @Column({ type: 'date', nullable: true })
  dob!: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ type: 'varchar', length: 10, default: 'rider' })
  selected_role!: 'rider' | 'driver' | 'both';

  @Column({ default: false })
  is_email_verified!: boolean;

  @Column({ default: false })
  is_phone_verified!: boolean;

  @Column({ default: false })
  is_verified!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  stripe_customer_id!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  stripe_subscription_id!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  stripe_account_id!: string | null;

  @Column({ default: false })
  stripe_charges_enabled!: boolean;

  @Column({ default: false })
  stripe_payouts_enabled!: boolean;

  @Column({ type: 'boolean', nullable: true })
  stripe_details_submitted!: boolean | null;

  @Column({ default: false })
  is_founding_member!: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  ytd_earnings!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  lifetime_earnings!: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_payout_at!: string | null;

  @Column({
    type: 'enum',
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  subscription_tier!: SubscriptionTier;

  @Column({ type: 'varchar', length: 50, nullable: true })
  referral_code!: string | null;

  @Column({ type: 'uuid', nullable: true })
  referred_by!: string | null;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0,
    nullable: true,
  })
  avg_rating!: number | null;

  @Column({ default: 0 })
  total_ratings!: number;

  @Column({ default: 0 })
  total_trips!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  display_name!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  gender!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  rider_conversation_style!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  rider_music_preference!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  rider_smoking_preference!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  rider_pet_preference!: string | null;

  @Column({ default: 'not_started' })
  background_check_status!: string;

  @Column({ default: false })
  is_suspended!: boolean;

  @Column({ default: false })
  is_banned!: boolean;

  @Column({ default: false })
  is_under_review!: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true })
  safe_word!: string | null;

  @Column({ default: false })
  biometric_consent_given!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  biometric_consent_at!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  ytd_gross_volume!: number;

  @Column({ default: false })
  w9_on_file!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  w9_submitted_at!: string | null;

  @Column({ default: false })
  tax_blocked!: boolean;

  @Column({ type: 'boolean', default: false })
  tax_notification_5k_sent!: boolean;

  @Column({ type: 'jsonb', default: {} })
  ride_preferences!: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  trial_ended_at!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  subscription_expires_at!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subscription_apple_original_transaction_id!: string | null;

  @Column({ default: false })
  onboarded!: boolean;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;

  @DeleteDateColumn()
  deleted_at!: string | null;
}
