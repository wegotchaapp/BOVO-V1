export { TripReply } from './trip-reply.entity';

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { TripStatus } from '../../common/enums';
import { User } from './user.entity';
import { Vehicle } from './profile.entities';

@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'driver_id' })
  driver!: User;

  @Column({ type: 'uuid' })
  vehicle_id!: string;

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle!: Vehicle;

  @Column()
  origin_metro!: string;

  @Column('text', { array: true })
  origin_pickup_zones!: string[];

  @Column()
  dest_metro!: string;

  @Column('text', { array: true })
  dest_dropoff_zones!: string[];

  @Column({ type: 'date' })
  departure_date!: string;

  @Column({ type: 'time' })
  departure_time!: string;

  @Column({ default: '+/- 30 min' })
  departure_time_window!: string;

  @Column({ type: 'int', default: 1 })
  seats_total!: number;

  @Column({ type: 'int' })
  seats_available!: number;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  per_seat_price!: number;

  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.POSTED })
  status!: TripStatus;

  @Column({ type: 'varchar', length: 300, nullable: true })
  notes!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  distance_miles!: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true })
  irs_rate_used!: number | null;

  @Column({ type: 'int', nullable: true })
  total_occupants_calc!: number | null;

  @Column('jsonb', { nullable: true })
  price_calculation_inputs!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 20, default: 'small' })
  luggage_capacity!: string;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  mapbox_route_polyline!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  expected_arrival_time!: string | null;

  @Column({ type: 'decimal', precision: 6, scale: 3, nullable: true })
  origin_lat!: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 3, nullable: true })
  origin_lng!: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 3, nullable: true })
  dest_lat!: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 3, nullable: true })
  dest_lng!: number | null;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;

  @DeleteDateColumn()
  deleted_at!: string | null;

  @OneToMany(() => TripPreference, (pref) => pref.trip)
  preferences!: TripPreference[];

  match_score?: number;
}

@Entity('trip_preferences')
export class TripPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  trip_id!: string;

  @ManyToOne(() => Trip)
  @JoinColumn({ name: 'trip_id' })
  trip!: Trip;

  @Column({ default: 'friendly' })
  conversation!: string;

  @Column({ default: 'background' })
  music!: string;

  @Column({ default: 'never' })
  smoking!: string;

  @Column({ default: 'with_approval' })
  pets!: string;

  @Column({ default: false })
  women_only!: boolean;
}

@Entity('trip_zones')
export class TripZone {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  trip_id!: string;

  @ManyToOne(() => Trip)
  @JoinColumn({ name: 'trip_id' })
  trip!: Trip;

  @Column()
  zone_type!: string;

  @Column()
  zone_name!: string;

  @Column({ type: 'text', nullable: true })
  polygon_wkt!: string | null;
}
