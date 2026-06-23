import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryColumn({ length: 32 })
  id!: string;

  @Column('text')
  subject!: string;

  @Column('text', { default: 'open' })
  status!: string;

  @Column('text', { default: 'normal' })
  priority!: string;

  @Column('text')
  requester_name!: string;

  @Column('text')
  requester_role!: string;

  @Column('text', { nullable: true })
  requester_email!: string | null;

  @Column('text', { nullable: true })
  requester_phone!: string | null;

  @Column('text', { nullable: true })
  requester_avatar_url!: string | null;

  @Column('varchar', { length: 64, nullable: true })
  trip_id!: string | null;

  @Column('text', { nullable: true })
  trip_origin!: string | null;

  @Column('text', { nullable: true })
  trip_destination!: string | null;

  @Column('timestamptz', { nullable: true })
  trip_departure_at!: Date | null;

  @Column('text', { nullable: true })
  trip_driver_name!: string | null;

  @Column('int', { nullable: true })
  trip_price_cents!: number | null;

  @Column('varchar', { length: 32, nullable: true })
  assignee_id!: string | null;

  @Column('timestamptz', { nullable: true })
  first_agent_response_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
