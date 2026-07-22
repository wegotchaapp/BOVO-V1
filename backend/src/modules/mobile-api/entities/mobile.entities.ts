/**
 * Self-contained TypeORM entities that back the Bovogo mobile app's `/api/*`
 * contract. These tables are intentionally isolated (prefixed `mobile_`) from
 * the platform's primary 47-entity schema so the mobile integration is purely
 * additive and cannot collide with or alter existing backend functionality.
 *
 * Ids are UUIDs; the mobile client treats all ids as opaque strings.
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('mobile_users')
export class MobileUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Index({ unique: true })
  @Column()
  email!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar' })
  password_hash!: string;

  @Column({ type: 'varchar', length: 12, nullable: true })
  role!: 'driver' | 'rider' | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 5 })
  rating!: string;

  @Column({ type: 'int', default: 0 })
  trips!: number;

  @Column({ type: 'boolean', default: false })
  is_verified!: boolean;

  @Column({ type: 'boolean', default: false })
  onboarded!: boolean;

  @Column({ type: 'boolean', default: false })
  is_founding_member!: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  stripe_customer_id!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  stripe_subscription_id!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  subscription_status!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  trial_ends_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  /** JSON array of language strings, e.g. ["English","Spanish"]. */
  @Column({ type: 'text', nullable: true })
  languages!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  emergency_name!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  emergency_phone!: string | null;

  /** Profile photo as data URL or remote URL (MVP stores data URL). */
  @Column({ type: 'text', nullable: true })
  photo_url!: string | null;

  /** JSON object of travel preference answers. */
  @Column({ type: 'text', nullable: true })
  ride_preferences!: string | null;

  /** JSON object of notification toggles. */
  @Column({ type: 'text', nullable: true })
  notification_settings!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  oauth_provider!: 'google' | 'apple' | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  oauth_subject!: string | null;

  /** When set, account is scheduled for permanent deletion (CCPA). */
  @Column({ type: 'timestamptz', nullable: true })
  deletion_requested_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

@Entity('mobile_vehicles')
export class MobileVehicle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 60 })
  make!: string;

  @Column({ type: 'varchar', length: 60 })
  model!: string;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'varchar', length: 40 })
  color!: string;

  @Column({ type: 'varchar', length: 20 })
  license_plate!: string;

  @Column({ type: 'varchar', length: 2, default: 'TX' })
  state!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  vin!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}

@Entity('mobile_ratings')
@Unique(['booking_id', 'rater_id'])
export class MobileRating {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  booking_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  rater_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  ratee_id!: string;

  @Column({ type: 'int' })
  score!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  /** JSON array of tag ids. */
  @Column({ type: 'text', nullable: true })
  tags!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

@Entity('mobile_sessions')
export class MobileSession {
  @PrimaryColumn({ length: 64 })
  token!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

@Entity('mobile_trips')
export class MobileTrip {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  driver_id!: string;

  @Column('text')
  from_city!: string;

  @Column('text')
  to_city!: string;

  @Column({ type: 'timestamptz' })
  departure_at!: Date;

  @Column({ type: 'int' })
  seats_available!: number;

  @Column({ type: 'int', default: 0 })
  luggage_space!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_per_seat!: string;

  @Column({ type: 'text', default: '' })
  note!: string;

  @Column({ type: 'text', nullable: true })
  car!: string | null;

  @Column({ type: 'boolean', default: false })
  pref_smoking!: boolean;

  @Column({ type: 'boolean', default: false })
  pref_pets!: boolean;

  @Column({ type: 'boolean', default: true })
  pref_music!: boolean;

  @Column({ type: 'boolean', default: true })
  pref_ac!: boolean;

  @Column({ type: 'varchar', length: 12, default: 'active' })
  status!: 'active' | 'in_progress' | 'cancelled' | 'completed';

  @Column({ type: 'text', nullable: true })
  start_video_url!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  started_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

@Entity('mobile_trip_replies')
@Index(['trip_id', 'created_at'])
export class MobileTripReply {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  trip_id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column('text')
  text!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

@Entity('mobile_trip_reply_reads')
@Unique(['user_id', 'trip_id'])
export class MobileTripReplyRead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'uuid' })
  trip_id!: string;

  @Column({ type: 'timestamptz' })
  last_read_at!: Date;
}

@Entity('mobile_bookings')
export class MobileBooking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  trip_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  rider_id!: string;

  @Column({ type: 'int' })
  seats!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_per_seat!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  service_fee!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount!: string;

  @Column({ type: 'varchar', length: 12 })
  payment_method!: 'card' | 'apple' | 'venmo';

  @Column({ type: 'varchar', length: 12, default: 'pending' })
  status!: 'pending' | 'confirmed' | 'cancelled' | 'completed';

  @Column({ type: 'varchar', length: 64, nullable: true })
  payment_intent_id!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;
}

@Entity('mobile_trip_groups')
@Unique(['trip_id'])
export class MobileTripGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  trip_id!: string;

  @Column({ type: 'text', nullable: true })
  pickup_hub_id!: string | null;

  @Column({ type: 'boolean', default: false })
  pickup_locked!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

@Entity('mobile_trip_group_members')
@Unique(['group_id', 'user_id'])
@Index(['user_id'])
export class MobileTripGroupMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  group_id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 12 })
  role!: 'driver' | 'rider';

  @CreateDateColumn({ type: 'timestamptz' })
  joined_at!: Date;
}

@Entity('mobile_trip_group_messages')
@Index(['group_id', 'created_at'])
export class MobileTripGroupMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  group_id!: string;

  @Column({ type: 'uuid', nullable: true })
  sender_id!: string | null;

  @Column('text')
  text!: string;

  @Column({ type: 'boolean', default: false })
  is_system!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

@Entity('mobile_driver_trips')
@Index(['driver_id', 'completed_at'])
export class MobileDriverTrip {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @Column('text')
  from_city!: string;

  @Column('text')
  to_city!: string;

  @Column({ type: 'int' })
  miles!: number;

  @Column({ type: 'int' })
  seats_booked!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  gross_amount!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  platform_fee!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  net_amount!: string;

  @Column({ type: 'timestamptz' })
  completed_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

/** 1:1 direct message thread between two users (ordered pair for uniqueness). */
@Entity('mobile_conversations')
@Unique(['user_low_id', 'user_high_id'])
export class MobileConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_low_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_high_id!: string;

  @Column({ type: 'text', nullable: true })
  last_message!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_message_at!: Date | null;

  /** Optional route label, e.g. "Austin → Houston". */
  @Column({ type: 'text', nullable: true })
  trip_label!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

@Entity('mobile_direct_messages')
export class MobileDirectMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  conversation_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  sender_id!: string;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'timestamptz', nullable: true })
  read_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

/** Live GPS points for an active adventure (driver and/or rider). */
@Entity('mobile_live_locations')
@Unique(['trip_id', 'user_id'])
export class MobileLiveLocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  trip_id!: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'varchar', length: 12 })
  role!: 'driver' | 'rider';

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ type: 'double precision', nullable: true })
  heading!: number | null;

  @Column({ type: 'double precision', nullable: true })
  speed!: number | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
