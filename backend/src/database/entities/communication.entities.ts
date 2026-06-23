import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Booking } from './booking.entities';
import { User } from './user.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  booking_id!: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column('text', { array: true })
  participant_ids!: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  last_message!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_message_at!: string | null;

  @Column({ default: 0 })
  unread_count!: number;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at!: string | null;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  conversation_id!: string;

  @ManyToOne(() => Conversation)
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @Column({ type: 'uuid' })
  sender_id!: string;

  @Column({ length: 2000 })
  content!: string;

  @Column({ default: false })
  is_flagged!: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  flag_category!: string | null;

  @Column({ default: false })
  is_read!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  read_at!: string | null;

  @Column({ default: false })
  requires_review!: boolean;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;
}

@Entity('notification_log')
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column()
  channel!: string;

  @Column()
  category!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ length: 1000 })
  body!: string;

  @Column({ type: 'jsonb', nullable: true })
  data!: Record<string, string> | null;

  @Column({ default: false })
  is_read!: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  delivery_status!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  delivered_at!: string | null;

  @CreateDateColumn()
  created_at!: string;
}

@Entity('notification_preferences')
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  user_id!: string;

  @Column({ type: 'jsonb', default: {} })
  preferences!: Record<string, Record<string, boolean>>;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;
}

@Entity('emergency_contacts')
export class EmergencyContact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column()
  name!: string;

  @Column()
  phone!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column()
  relationship!: string;

  @Column({ default: false })
  opted_in!: boolean;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;

  @DeleteDateColumn()
  deleted_at!: string | null;
}

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column()
  expo_push_token!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  device_id!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  platform!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  timezone!: string | null;

  @Column({ default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;
}

