import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('driver_trips')
@Index(['driver_id', 'completed_at'])
export class DriverTrip {
  @PrimaryColumn({ length: 32 })
  id!: string;

  @Column({ length: 32 })
  driver_id!: string;

  @Column('text')
  from_city!: string;

  @Column('text')
  to_city!: string;

  @Column('int')
  miles!: number;

  @Column('int')
  seats_booked!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  gross_amount!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  platform_fee!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  net_amount!: number;

  @Column('timestamptz')
  completed_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
