import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('trip_replies')
@Index(['trip_id', 'created_at'])
export class TripReply {
  @PrimaryColumn({ length: 32 })
  id!: string;

  @Column({ length: 32 })
  trip_id!: string;

  @Column({ length: 32 })
  user_id!: string;

  @Column('text')
  text!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

@Entity('trip_reply_reads')
@Index(['reply_id', 'user_id'])
export class TripReplyRead {
  @PrimaryColumn({ length: 32 })
  id!: string;

  @Column({ length: 32 })
  reply_id!: string;

  @Column({ length: 32 })
  user_id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  read_at!: Date;
}
