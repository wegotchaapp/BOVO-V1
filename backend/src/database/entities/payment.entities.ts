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

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  booking_id!: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column()
  stripe_payment_intent_id!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column()
  currency!: string;

  @Column()
  status!: string;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;
}

@Entity('payouts')
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'driver_id' })
  driver!: User;

  @Column()
  stripe_transfer_id!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column()
  currency!: string;

  @Column()
  status!: string;

  @Column({ type: 'timestamptz', nullable: true })
  dispatched_at!: string | null;

  @CreateDateColumn()
  created_at!: string;
}

@Entity('refunds')
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  payment_id!: string;

  @ManyToOne(() => Payment)
  @JoinColumn({ name: 'payment_id' })
  payment!: Payment;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column()
  reason!: string;

  @Column()
  stripe_refund_id!: string;

  @Column()
  status!: string;

  @CreateDateColumn()
  created_at!: string;
}

@Entity('insurance_policies')
export class InsurancePolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  booking_id!: string;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @Column({ type: 'varchar', length: 255, nullable: true })
  policy_number!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  mga_reference!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  activated_at!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  expires_at!: string | null;

  @Column({ default: false })
  is_active!: boolean;

  @Column({ type: 'int', default: 0 })
  mga_remitted_cents!: number;

  @Column({ type: 'timestamptz', nullable: true })
  mga_remitted_at!: string | null;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;
}
