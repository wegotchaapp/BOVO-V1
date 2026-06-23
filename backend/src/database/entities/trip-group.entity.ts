import { Entity, Column, PrimaryColumn, CreateDateColumn, Unique, Index } from 'typeorm';

@Entity('trip_groups')
@Unique(['trip_id'])
export class TripGroup {
  @PrimaryColumn({ length: 32 })
  id!: string;

  @Column({ length: 32 })
  trip_id!: string;

  @Column('text', { nullable: true })
  pickup_hub_id!: string | null;

  @Column('boolean', { default: false })
  pickup_locked!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

@Entity('trip_group_members')
@Unique(['group_id', 'user_id'])
@Index(['user_id'])
export class TripGroupMember {
  @PrimaryColumn({ length: 32 })
  id!: string;

  @Column({ length: 32 })
  group_id!: string;

  @Column({ length: 32 })
  user_id!: string;

  @Column({ length: 12 })
  role!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  joined_at!: Date;
}

@Entity('trip_group_messages')
@Index(['group_id', 'created_at'])
export class TripGroupMessage {
  @PrimaryColumn({ length: 32 })
  id!: string;

  @Column({ length: 32 })
  group_id!: string;

  @Column('varchar', { length: 32, nullable: true })
  sender_id!: string | null;

  @Column('text')
  text!: string;

  @Column('boolean', { default: false })
  is_system!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

@Entity('trip_group_pickup_approvals')
@Unique(['group_id', 'user_id'])
export class TripGroupPickupApproval {
  @PrimaryColumn({ length: 32 })
  id!: string;

  @Column({ length: 32 })
  group_id!: string;

  @Column({ length: 32 })
  user_id!: string;

  @Column('text')
  hub_id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
