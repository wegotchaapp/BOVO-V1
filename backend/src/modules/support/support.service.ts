import { Injectable, NotFoundException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { v4 as uuid } from 'uuid';
import * as bcrypt from 'bcrypt';
import { PinoLogger } from 'nestjs-pino';
import { SupportAgent } from '../../database/entities/support-agent.entity';
import { SupportTicket } from '../../database/entities/support-ticket.entity';
import { SupportTicketMessage } from '../../database/entities/support-ticket-message.entity';
import { SupportSession } from '../../database/entities/support-session.entity';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportAgent)
    private readonly agentRepo: Repository<SupportAgent>,
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(SupportTicketMessage)
    private readonly messageRepo: Repository<SupportTicketMessage>,
    @InjectRepository(SupportSession)
    private readonly sessionRepo: Repository<SupportSession>,
    private readonly logger: PinoLogger,
  ) {}

  async login(email: string, password: string): Promise<{ agent: SupportAgent; session: SupportSession }> {
    const agent = await this.agentRepo.findOne({ where: { email } });
    if (!agent) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const session = this.sessionRepo.create({
      id: uuid(),
      agent_id: agent.id,
      expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000),
    });

    const saved = await this.sessionRepo.save(session);

    this.logger.info({ agentId: agent.id, sessionId: saved.id }, 'Support agent logged in');

    return { agent, session: saved };
  }

  async listTickets(query: {
    status?: string;
    priority?: string;
    assignee_id?: string;
    page?: number;
    limit?: number;
  }): Promise<{ tickets: any[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.assignee_id) where.assignee_id = query.assignee_id;

    const [tickets, total] = await this.ticketRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    const ticketIds = tickets.map((t) => t.id);
    const messageCounts = await this.messageRepo
      .createQueryBuilder('m')
      .select('m.ticket_id', 'ticket_id')
      .addSelect('COUNT(m.id)', 'count')
      .where('m.ticket_id IN (:...ticketIds)', { ticketIds })
      .groupBy('m.ticket_id')
      .getRawMany();

    const countMap = new Map<string, number>();
    for (const row of messageCounts) {
      countMap.set(row.ticket_id, parseInt(row.count, 10));
    }

    const ticketsWithCounts = tickets.map((ticket) => ({
      ...ticket,
      messages_count: countMap.get(ticket.id) || 0,
    }));

    return { tickets: ticketsWithCounts, total, page, limit };
  }

  async getTicket(id: string): Promise<any> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const messages = await this.messageRepo.find({
      where: { ticket_id: id },
      order: { created_at: 'ASC' },
    });

    return { ...ticket, messages };
  }

  async createTicket(dto: {
    subject: string;
    requester_name: string;
    requester_role: string;
    requester_email?: string;
    requester_phone?: string;
    trip_id?: string;
    trip_origin?: string;
    trip_destination?: string;
    trip_departure_at?: string;
    trip_driver_name?: string;
    trip_price_cents?: number;
  }): Promise<SupportTicket> {
    const ticket = this.ticketRepo.create({
      id: uuid(),
      subject: dto.subject,
      requester_name: dto.requester_name,
      requester_role: dto.requester_role,
      requester_email: dto.requester_email || null,
      requester_phone: dto.requester_phone || null,
      trip_id: dto.trip_id || null,
      trip_origin: dto.trip_origin || null,
      trip_destination: dto.trip_destination || null,
      trip_departure_at: dto.trip_departure_at ? new Date(dto.trip_departure_at) : null,
      trip_driver_name: dto.trip_driver_name || null,
      trip_price_cents: dto.trip_price_cents || null,
      status: 'open',
      priority: 'normal',
    });

    const saved = await this.ticketRepo.save(ticket);

    const systemMessage = this.messageRepo.create({
      id: uuid(),
      ticket_id: saved.id,
      body: `Ticket created by ${dto.requester_name} (${dto.requester_role})`,
      author_type: 'system',
      author_name: 'System',
      internal: false,
    });

    await this.messageRepo.save(systemMessage);

    this.logger.info({ ticketId: saved.id, requester: dto.requester_name }, 'Support ticket created');

    return saved;
  }

  async addMessage(
    ticketId: string,
    dto: {
      body: string;
      author_type: string;
      author_name: string;
      author_agent_id?: string;
      internal?: boolean;
    },
  ): Promise<SupportTicketMessage> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const message = this.messageRepo.create({
      id: uuid(),
      ticket_id: ticketId,
      body: dto.body,
      author_type: dto.author_type,
      author_name: dto.author_name,
      author_agent_id: dto.author_agent_id || null,
      internal: dto.internal || false,
    });

    const saved = await this.messageRepo.save(message);

    if (dto.author_type === 'agent' && !ticket.first_agent_response_at) {
      await this.ticketRepo.update(ticketId, { first_agent_response_at: new Date() });
    }

    return saved;
  }

  async updateTicketStatus(ticketId: string, status: string, agentId: string): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    ticket.status = status;
    const saved = await this.ticketRepo.save(ticket);

    this.logger.info({ ticketId, status, agentId }, 'Ticket status updated');

    return saved;
  }

  async assignTicket(ticketId: string, agentId: string): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    ticket.assignee_id = agentId;
    const saved = await this.ticketRepo.save(ticket);

    this.logger.info({ ticketId, agentId }, 'Ticket assigned');

    return saved;
  }

  async listAgents(): Promise<SupportAgent[]> {
    return this.agentRepo.find({ order: { name: 'ASC' } });
  }

  async createAgent(dto: { name: string; email: string; password: string; role?: string }): Promise<SupportAgent> {
    const existing = await this.agentRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An agent with this email already exists');
    }

    const password_hash = await bcrypt.hash(dto.password, 10);

    const agent = this.agentRepo.create({
      id: uuid(),
      name: dto.name,
      email: dto.email,
      password_hash,
      role: dto.role || 'agent',
    });

    const saved = await this.agentRepo.save(agent);

    this.logger.info({ agentId: saved.id, email: saved.email }, 'Support agent created');

    return saved;
  }

  async getDashboardStats(): Promise<any> {
    const [open, pending, resolved] = await Promise.all([
      this.ticketRepo.count({ where: { status: 'open' } }),
      this.ticketRepo.count({ where: { status: 'pending' } }),
      this.ticketRepo.count({ where: { status: 'resolved' } }),
    ]);

    const unassigned = await this.ticketRepo.count({ where: { assignee_id: '' } });

    const priorityCounts = await this.ticketRepo
      .createQueryBuilder('t')
      .select('t.priority', 'priority')
      .addSelect('COUNT(t.id)', 'count')
      .groupBy('t.priority')
      .getRawMany();

    const byPriority: Record<string, number> = {};
    for (const row of priorityCounts) {
      byPriority[row.priority] = parseInt(row.count, 10);
    }

    return {
      open,
      pending,
      resolved,
      unassigned,
      by_priority: byPriority,
    };
  }
}
