import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Booking } from './booking.entities';
import { User } from './user.entity';

@Entity('chat_conversations')
export class ChatConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  booking_id!: string | null;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column('uuid', { array: true })
  participant_ids!: string[];

  @Column({ type: 'varchar', length: 200, nullable: true })
  title!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'booking' })
  type!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  last_message!: string | null;

  @Column({ type: 'uuid', nullable: true })
  last_message_sender_id!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_message_at!: string | null;

  @Column({ type: 'int', default: 0 })
  unread_count_driver!: number;

  @Column({ type: 'int', default: 0 })
  unread_count_rider!: number;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: string;
}

@Entity('chat_messages')
@Index(['conversation_id', 'created_at'])
@Index(['sender_id'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  conversation_id!: string;

  @ManyToOne(() => ChatConversation)
  @JoinColumn({ name: 'conversation_id' })
  conversation!: ChatConversation;

  @Column({ type: 'uuid' })
  sender_id!: string;

  @Column({ type: 'varchar', length: 2000 })
  content!: string;

  @Column({ type: 'boolean', default: false })
  is_flagged!: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  flag_category!: string | null;

  @Column({ type: 'boolean', default: false })
  requires_review!: boolean;

  @Column({ type: 'boolean', default: false })
  is_read!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  read_at!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: string;
}

@Entity('chat_blocks')
@Index(['blocker_id', 'blocked_user_id'], { unique: true })
export class ChatBlock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  blocker_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'blocker_id' })
  blocker!: User;

  @Column({ type: 'uuid' })
  blocked_user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'blocked_user_id' })
  blockedUser!: User;

  @Column({ type: 'uuid' })
  booking_id!: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: string;
}

@Entity('call_records')
export class CallRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  booking_id!: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column({ type: 'uuid' })
  caller_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'caller_id' })
  caller!: User;

  @Column({ type: 'uuid' })
  receiver_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'receiver_id' })
  receiver!: User;

  @Column({ type: 'varchar', length: 255 })
  twilio_call_sid!: string;

  @Column({ type: 'int', nullable: true })
  duration_seconds!: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: string;
}
