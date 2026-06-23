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
import { User } from './user.entity';
import { VehicleCategory } from '../../common/enums';

export type LuggageCapacity = 'small' | 'medium' | 'large';

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column()
  display_name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bio!: string | null;

  @Column('text', { array: true, default: [] })
  languages!: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  profile_photo_url!: string | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  avg_rating!: number | null;

  @Column({ default: 0 })
  total_trips!: number;

  @Column('text', { array: true, default: [] })
  badges!: string[];

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;

  @DeleteDateColumn()
  deleted_at!: string | null;
}

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  driver_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'driver_id' })
  driver!: User;

  @Column()
  make!: string;

  @Column()
  model!: string;

  @Column({ type: 'int' })
  year!: number;

  @Column()
  color!: string;

  @Column()
  license_plate!: string;

  @Column({ length: 2 })
  state!: string;

  @Column({ type: 'varchar', length: 17, nullable: true })
  vin!: string | null;

  @Column({ type: 'enum', enum: VehicleCategory })
  category!: VehicleCategory;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  max_luggage_class!: LuggageCapacity;

  @Column({ type: 'int', default: 4 })
  max_passengers!: number;

  @Column({ default: false })
  is_verified!: boolean;

  @Column('jsonb', { default: {} })
  photo_urls!: Record<string, string>;

  @Column('jsonb', { default: {} })
  documents!: Record<string, { storage_path: string; expires_at: string | null }>;

  @Column({ type: 'text', nullable: true })
  category_assignment_reason!: string | null;

  @Column({ default: false })
  category_manually_overridden!: boolean;

  @Column({ type: 'boolean', default: false })
  insurance_verified!: boolean;

  @CreateDateColumn()
  created_at!: string;

  @UpdateDateColumn()
  updated_at!: string;

  @DeleteDateColumn()
  deleted_at!: string | null;
}
