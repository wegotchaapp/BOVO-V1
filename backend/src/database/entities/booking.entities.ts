import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BookingStatus, LuggageType } from '../../common/enums';
import { Trip } from './trip.entities';
import { User } from './user.entity';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  trip_id!: string;

  @ManyToOne(() => Trip)
  @JoinColumn({ name: 'trip_id' })
  trip!: Trip;

  @Column({ type: 'uuid' })
  rider_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'rider_id' })
  rider!: User;

  @Column({ type: 'int' })
  seats!: number;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  total_price!: number;

  @Column({ default: false })
  insurance_opted_in!: boolean;

  @Column({ default: false })
  luggage_insurance_opted_in!: boolean;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status!: BookingStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  payment_intent_id!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  share_token!: string | null;

  @Column({ type: 'text', nullable: true })
  last_known_location!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_ping_at!: string | null;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;
}

@Entity('booking_luggage')
export class BookingLuggage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  booking_id!: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column({ type: 'varchar', length: 20 })
  type!: LuggageType;

  @Column({ type: 'int' })
  quantity!: number;
}

@Entity('booking_status_log')
export class BookingStatusLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  booking_id!: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column()
  from_status!: string;

  @Column()
  to_status!: string;

  @Column({ type: 'uuid' })
  changed_by!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason!: string | null;

  @CreateDateColumn()
  created_at!: string;
}
