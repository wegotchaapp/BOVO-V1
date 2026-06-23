import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Booking } from './booking.entities';
import { User } from './user.entity';
import { SosTriggerType, SosStatus, ReportCategory, ReportSeverity, ModerationActionType, AppealStatus } from '../../common/enums';

@Entity('trip_pings')
export class TripPing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  booking_id!: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column({ type: 'text', nullable: true })
  location!: string | null;

  @Column({ type: 'float', nullable: true })
  accuracy!: number | null;

  @Column({ type: 'float', nullable: true })
  speed!: number | null;

  @Column({ type: 'int', nullable: true })
  battery_level!: number | null;

  @Column({ type: 'timestamptz' })
  timestamp!: string;

  @CreateDateColumn()
  created_at!: string;
}

@Entity('sos_events')
export class SosEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid', nullable: true })
  booking_id!: string | null;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column({ type: 'enum', enum: SosTriggerType })
  trigger_type!: SosTriggerType;

  @Column({ type: 'enum', enum: SosStatus, default: SosStatus.ACTIVE })
  status!: SosStatus;

  @Column({ type: 'float' })
  latitude!: number;

  @Column({ type: 'float' })
  longitude!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  noonlight_alarm_id!: string | null;

  @CreateDateColumn()
  created_at!: string;
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  reporter_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reporter_id' })
  reporter!: User;

  @Column({ type: 'uuid' })
  reported_user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reported_user_id' })
  reported_user!: User;

  @Column({ type: 'uuid', nullable: true })
  booking_id!: string | null;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column({ type: 'enum', enum: ReportCategory })
  category!: ReportCategory;

  @Column({ length: 1000 })
  description!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  evidence_photo_url!: string | null;

  @Column({ type: 'enum', enum: ReportSeverity })
  severity!: ReportSeverity;

  @Column({ type: 'timestamptz' })
  sla_deadline!: string;

  @Column({ default: 'pending' })
  status!: string;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at!: string | null;

  @CreateDateColumn()
  created_at!: string;
}

@Entity('moderation_actions')
export class ModerationAction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  report_id!: string;

  @ManyToOne(() => Report)
  @JoinColumn({ name: 'report_id' })
  report!: Report;

  @Column({ type: 'uuid' })
  taken_by!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'taken_by' })
  takenBy!: User;

  @Column({ type: 'enum', enum: ModerationActionType })
  action_type!: ModerationActionType;

  @Column({ length: 500 })
  reason!: string;

  @Column('text', { array: true, default: [] })
  evidence_refs!: string[];

  @Column({ type: 'int', nullable: true })
  suspension_days!: number | null;

  @CreateDateColumn()
  created_at!: string;
}

@Entity('suspensions')
export class Suspension {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'timestamptz' })
  starts_at!: string;

  @Column({ type: 'timestamptz' })
  ends_at!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason!: string | null;

  @Column({ type: 'uuid', nullable: true })
  moderation_action_id!: string | null;

  @CreateDateColumn()
  created_at!: string;
}

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ nullable: true, type: 'uuid' })
  booking_id!: string | null;

  @Column({ default: 'P1' })
  severity!: string;

  @Column()
  description!: string;

  @Column({ default: 'open' })
  status!: string;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;
}

@Entity('deviation_events')
export class DeviationEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  booking_id!: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column({ type: 'text', nullable: true })
  actual_location!: string | null;

  @Column({ type: 'text', nullable: true })
  expected_location!: string | null;

  @Column({ type: 'float' })
  deviation_distance_miles!: number;

  @Column({ type: 'int', nullable: true })
  time_off_route_seconds!: number | null;

  @Column({ default: 'pending' })
  status!: string;

  @Column({ type: 'timestamptz', nullable: true })
  responded_at!: string | null;

  @Column({ type: 'text', nullable: true })
  response!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  ts_paged_at!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  contacts_notified_at!: string | null;

  @CreateDateColumn()
  created_at!: string;
}

@Entity('appeals')
export class Appeal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid' })
  action_id!: string;

  @ManyToOne(() => ModerationAction)
  @JoinColumn({ name: 'action_id' })
  action!: ModerationAction;

  @Column({ length: 2000 })
  reason!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  evidence_url!: string | null;

  @Column({ type: 'enum', enum: AppealStatus, default: AppealStatus.PENDING })
  status!: AppealStatus;

  @Column({ type: 'uuid', nullable: true })
  reviewed_by!: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewed_by' })
  reviewer!: User;

  @Column({ type: 'varchar', length: 500, nullable: true })
  decision!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at!: string | null;

  @CreateDateColumn()
  created_at!: string;
}
