import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('support_ticket_messages')
export class SupportTicketMessage {
  @PrimaryColumn({ length: 32 })
  id!: string;

  @Column({ length: 32 })
  ticket_id!: string;

  @Column('text')
  body!: string;

  @Column('text')
  author_type!: string;

  @Column('text')
  author_name!: string;

  @Column('varchar', { length: 32, nullable: true })
  author_agent_id!: string | null;

  @Column('boolean', { default: false })
  internal!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
