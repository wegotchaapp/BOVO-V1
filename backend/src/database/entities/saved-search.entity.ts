import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('saved_searches')
export class SavedSearch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column()
  origin_metro!: string;

  @Column()
  dest_metro!: string;

  @Column({ type: 'date' })
  travel_date!: string;

  @Column({ default: 1 })
  seats_needed!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  conversation_style!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  music_preference!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  smoking_preference!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  pet_preference!: string | null;

  @Column({ default: false })
  women_only!: boolean;

  @Column({ default: false })
  strict_filters!: boolean;

  @Column({ default: 'best_match' })
  sort_by!: string;

  @Column({ default: 0 })
  usage_count!: number;

  @CreateDateColumn()
  created_at!: string;
}
