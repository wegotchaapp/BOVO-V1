import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, MoreThanOrEqual, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { Trip } from '../../database/entities/trip.entities';
import { Booking } from '../../database/entities/booking.entities';
import { Payment, Payout } from '../../database/entities/payment.entities';
import { SosEvent, Incident } from '../../database/entities/safety.entities';
import { Vehicle } from '../../database/entities/profile.entities';
import { AuditEvent } from '../../database/entities/audit.entity';
import { SupportTicket } from '../../database/entities/support-ticket.entity';
import { SupportTicketMessage } from '../../database/entities/support-ticket-message.entity';
import { SupportAgent } from '../../database/entities/support-agent.entity';
import { TripStatus, BookingStatus, SubscriptionTier } from '../../common/enums';
import {
  MobileUser,
  MobileVehicle,
} from '../mobile-api/entities/mobile.entities';

interface PageParams {
  page?: number | string;
  limit?: number | string;
  search?: string;
  role?: string;
  status?: string;
}

function paginate(p: PageParams) {
  const page = Math.max(1, Number(p.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(p.limit) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

function newId(): string {
  return randomBytes(16).toString('hex'); // 32 chars
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

const ACTIVE_TRIP_STATUSES = [
  TripStatus.POSTED,
  TripStatus.BOOKED,
  TripStatus.CONFIRMED,
  TripStatus.EN_ROUTE,
  TripStatus.IN_PROGRESS,
];
const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.EN_ROUTE,
];

/**
 * Minimal admin service backing the Bovogo admin dashboard. Reads/writes the
 * platform's primary entities. System config is held in-memory (no config table
 * exists in the schema).
 */
@Injectable()
export class AdminService {
  private systemConfig: Record<string, unknown> = {
    irs_mileage_rate: Number(process.env.IRS_MILEAGE_RATE) || 0.67,
    service_fee_rate: 0.06,
    founding_member_limit: 10000,
    maintenance_mode: false,
  };

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Payout) private readonly payouts: Repository<Payout>,
    @InjectRepository(SosEvent) private readonly sos: Repository<SosEvent>,
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(MobileVehicle)
    private readonly mobileVehicles: Repository<MobileVehicle>,
    @InjectRepository(MobileUser)
    private readonly mobileUsers: Repository<MobileUser>,
    @InjectRepository(AuditEvent)
    private readonly audit: Repository<AuditEvent>,
    @InjectRepository(SupportTicket)
    private readonly tickets: Repository<SupportTicket>,
    @InjectRepository(SupportTicketMessage)
    private readonly ticketMessages: Repository<SupportTicketMessage>,
    @InjectRepository(SupportAgent)
    private readonly agents: Repository<SupportAgent>,
  ) {}

  // ─── Dashboard ───────────────────────────────────────────────────────────
  async dashboard() {
    const today = startOfToday();
    const month = startOfMonth();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalDrivers,
      usersToday,
      newUsersThisMonth,
      activeUsers,
      activeTrips,
      activeBookings,
      tripsToday,
      tripsThisMonth,
      pendingPayouts,
      openIncidents,
    ] = await Promise.all([
      this.users.count(),
      this.users.count({ where: { selected_role: In(['driver', 'both']) } }),
      this.users.count({ where: { created_at: MoreThanOrEqual(today.toISOString()) } }),
      this.users.count({ where: { created_at: MoreThanOrEqual(month.toISOString()) } }),
      this.users.count({ where: { updated_at: MoreThanOrEqual(sevenDaysAgo.toISOString()) } }),
      this.trips.count({ where: { status: In(ACTIVE_TRIP_STATUSES) } }),
      this.bookings.count({ where: { status: In(ACTIVE_BOOKING_STATUSES) } }),
      this.trips.count({ where: { created_at: MoreThanOrEqual(today.toISOString()) } }),
      this.trips.count({ where: { created_at: MoreThanOrEqual(month.toISOString()) } }),
      this.payouts.count({ where: { status: In(['pending', 'in_transit']) } }).catch(() => 0),
      this.incidents.count({ where: { status: 'open' } }).catch(() => 0),
    ]);

    const revenueThisMonth = await this.sumPayments(month);

    const [openTickets, pendingTickets, totalTickets, activeAgents] =
      await Promise.all([
        this.tickets.count({ where: { status: 'open' } }).catch(() => 0),
        this.tickets.count({ where: { status: 'pending' } }).catch(() => 0),
        this.tickets.count().catch(() => 0),
        this.agents.count({ where: { is_active: true } }).catch(() => 0),
      ]);
    const resolvedToday = await this.tickets
      .count({
        where: {
          status: In(['resolved', 'closed']),
          updated_at: MoreThanOrEqual(today),
        },
      })
      .catch(() => 0);

    return {
      totalUsers,
      totalDrivers,
      usersToday,
      newUsersThisMonth,
      activeUsers,
      activeTrips,
      activeBookings,
      tripsToday,
      tripsThisMonth,
      revenueThisMonth,
      pendingPayouts,
      openIncidents,
      supportTickets: {
        open: openTickets,
        pending: pendingTickets,
        resolvedToday,
        total: totalTickets,
        activeAgents,
      },
      tripsTrend: await this.tripsTrend(),
      revenueTrend: await this.revenueTrend(),
    };
  }

  private async sumPayments(since: Date): Promise<number> {
    try {
      const { sum } = await this.payments
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount), 0)', 'sum')
        .where('p.created_at >= :since', { since: since.toISOString() })
        .andWhere("p.status IN ('succeeded','paid','captured','requires_capture')")
        .getRawOne();
      return Number(sum) || 0;
    } catch {
      return 0;
    }
  }

  private async tripsTrend() {
    const out: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const count = await this.trips.count({
        where: { created_at: Between(start.toISOString(), end.toISOString()) },
      });
      out.push({ date: start.toISOString(), count });
    }
    return out;
  }

  private async revenueTrend() {
    const out: { date: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      let amount = 0;
      try {
        const { sum } = await this.payments
          .createQueryBuilder('p')
          .select('COALESCE(SUM(p.amount), 0)', 'sum')
          .where('p.created_at >= :start AND p.created_at < :end', {
            start: start.toISOString(),
            end: end.toISOString(),
          })
          .andWhere("p.status IN ('succeeded','paid','captured','requires_capture')")
          .getRawOne();
        amount = Number(sum) || 0;
      } catch {
        amount = 0;
      }
      out.push({ date: start.toISOString(), amount });
    }
    return out;
  }

  // ─── Users ───────────────────────────────────────────────────────────────
  async listUsers(p: PageParams) {
    const { skip, take } = paginate(p);
    const qb = this.users
      .createQueryBuilder('u')
      .orderBy('u.created_at', 'DESC')
      .skip(skip)
      .take(take);
    if (p.search) {
      qb.andWhere(
        '(u.name ILIKE :s OR u.email ILIKE :s OR u.phone ILIKE :s)',
        { s: `%${p.search}%` },
      );
    }
    if (p.role) qb.andWhere('u.role = :role', { role: p.role });
    const [users, total] = await qb.getManyAndCount();
    return { users, total };
  }

  async userDetail(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async suspendUser(id: string, reason: string) {
    await this.users.update({ id }, { is_suspended: true });
    return { ok: true, id, reason };
  }

  async unsuspendUser(id: string) {
    await this.users.update({ id }, { is_suspended: false });
    return { ok: true, id };
  }

  async banUser(id: string, reason: string) {
    await this.users.update({ id }, { is_banned: true, is_suspended: true });
    return { ok: true, id, reason };
  }

  // ─── Trips / Bookings / Payments ──────────────────────────────────────────
  async listTrips(p: PageParams) {
    const { skip, take } = paginate(p);
    const where = p.status ? { status: p.status as TripStatus } : {};
    const [trips, total] = await this.trips.findAndCount({
      where,
      relations: ['driver'],
      order: { created_at: 'DESC' },
      skip,
      take,
    });
    return { trips, total };
  }

  async cancelTrip(id: string, reason: string) {
    await this.trips.update({ id }, { status: TripStatus.CANCELLED });
    return { ok: true, id, reason };
  }

  async listBookings(p: PageParams) {
    const { skip, take } = paginate(p);
    const where = p.status ? { status: p.status as BookingStatus } : {};
    const [bookings, total] = await this.bookings.findAndCount({
      where,
      relations: ['trip', 'rider'],
      order: { created_at: 'DESC' },
      skip,
      take,
    });
    return { bookings, total };
  }

  async listPayments(p: PageParams) {
    const { skip, take } = paginate(p);
    const [payments, total] = await this.payments.findAndCount({
      order: { created_at: 'DESC' },
      skip,
      take,
    });
    return { payments, total };
  }

  // ─── Safety ───────────────────────────────────────────────────────────────
  async sosAlerts() {
    return this.sos.find({
      relations: ['user'],
      order: { created_at: 'DESC' },
      take: 100,
    });
  }

  async listIncidents(p: PageParams) {
    const { skip, take } = paginate(p);
    const where = p.status ? { status: p.status } : {};
    const [incidents, total] = await this.incidents.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip,
      take,
    });
    return { incidents, total };
  }

  // ─── Config ───────────────────────────────────────────────────────────────
  getConfig() {
    return this.systemConfig;
  }

  updateConfig(updates: Record<string, unknown>) {
    this.systemConfig = { ...this.systemConfig, ...updates };
    return this.systemConfig;
  }

  // ─── Subscriptions ────────────────────────────────────────────────────────
  async listSubscriptions(p: PageParams) {
    const { skip, take } = paginate(p);
    const [subscriptions, total] = await this.users.findAndCount({
      where: { subscription_tier: SubscriptionTier.PREMIUM },
      order: { created_at: 'DESC' },
      skip,
      take,
    });
    return { subscriptions, total };
  }

  async overrideTrial(userId: string, days: number) {
    const expires = new Date();
    expires.setDate(expires.getDate() + Number(days || 0));
    await this.users.update(
      { id: userId },
      {
        subscription_tier: SubscriptionTier.PREMIUM,
        subscription_expires_at: expires.toISOString(),
      },
    );
    return { ok: true, userId, trialEndsAt: expires.toISOString() };
  }

  broadcastNotification(title: string, body: string, role?: string) {
    // Push delivery is handled by NotificationsModule in production; this admin
    // endpoint acknowledges the request for the MVP dashboard.
    return { ok: true, title, body, role: role ?? 'all', queued: true };
  }

  // ─── Driver docs ──────────────────────────────────────────────────────────
  async driverDocs() {
    const [vehicles, pendingBackgroundChecks, pendingW9] = await Promise.all([
      this.vehicles.find({
        where: { is_verified: false },
        relations: ['driver'],
        take: 100,
      }),
      this.users.find({
        where: { background_check_status: In(['pending', 'not_started']) },
        take: 100,
      }),
      this.users.find({ where: { w9_on_file: false }, take: 100 }),
    ]);
    return { vehicles, verifications: [], pendingBackgroundChecks, pendingW9 };
  }

  async verifyVehicle(id: string, approved: boolean) {
    await this.vehicles.update({ id }, { is_verified: approved });
    return { ok: true, id, approved };
  }

  // ─── Audit ────────────────────────────────────────────────────────────────
  async listAudit(p: PageParams) {
    const { skip, take } = paginate(p);
    try {
      const [events, total] = await this.audit.findAndCount({
        order: { created_at: 'DESC' },
        skip,
        take,
      });
      return { events, total };
    } catch {
      return { events: [], total: 0 };
    }
  }

  // ─── Support ──────────────────────────────────────────────────────────────
  async listTickets(p: PageParams) {
    const { skip, take } = paginate(p);
    const where = p.status ? { status: p.status } : {};
    const [tickets, total] = await this.tickets.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip,
      take,
    });
    return { tickets, total };
  }

  async getTicket(id: string) {
    const ticket = await this.tickets.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async updateTicketStatus(id: string, status: string) {
    await this.tickets.update({ id }, { status });
    return this.getTicket(id);
  }

  async ticketMessagesFor(ticketId: string) {
    return this.ticketMessages.find({
      where: { ticket_id: ticketId },
      order: { created_at: 'ASC' },
    });
  }

  async addTicketMessage(
    ticketId: string,
    dto: { body: string; author_name?: string; internal?: boolean },
  ) {
    const msg = this.ticketMessages.create({
      id: newId(),
      ticket_id: ticketId,
      body: dto.body,
      author_type: 'agent',
      author_name: dto.author_name ?? 'Admin',
      internal: dto.internal ?? false,
    });
    return this.ticketMessages.save(msg);
  }

  async listAgents() {
    const agents = await this.agents.find({ order: { created_at: 'DESC' } });
    return agents.map(({ password_hash, ...rest }) => rest);
  }

  async createAgent(dto: {
    name: string;
    email: string;
    password: string;
    role?: string;
  }) {
    const agent = this.agents.create({
      id: newId(),
      name: dto.name,
      email: dto.email,
      password_hash: await bcrypt.hash(dto.password, 12),
      role: dto.role ?? 'agent',
      is_active: true,
    });
    const saved = await this.agents.save(agent);
    const { password_hash, ...rest } = saved;
    return rest;
  }

  async toggleAgent(id: string, active: boolean) {
    await this.agents.update({ id }, { is_active: active });
    return { ok: true, id, active };
  }

  /**
   * Vehicles a Voyager has fully documented and which are waiting on a human.
   *
   * This is the mobile fleet (`mobile_vehicles`), which is a different table from
   * the legacy `vehicles` that `driverDocs`/`verifyVehicle` operate on — approving
   * there has never had any effect on a mobile Voyager.
   */
  async vehicleReviewQueue(status = 'pending_review') {
    const vehicles = await this.mobileVehicles.find({
      where: { verification_status: status as MobileVehicle['verification_status'] },
      order: { updated_at: 'ASC' },
      take: 100,
    });
    const owners = vehicles.length
      ? await this.mobileUsers.find({
          where: { id: In(vehicles.map((v) => v.user_id)) },
        })
      : [];
    const byId = new Map(owners.map((o) => [o.id, o]));
    return {
      vehicles: vehicles.map((v) => {
        const owner = byId.get(v.user_id);
        return {
          id: v.id,
          userId: v.user_id,
          ownerName: owner?.name ?? null,
          ownerEmail: owner?.email ?? null,
          make: v.make,
          model: v.model,
          year: v.year,
          color: v.color,
          licensePlate: v.license_plate,
          state: v.state,
          vin: v.vin,
          seatCount: v.seat_count,
          doorCount: v.door_count,
          photos: {
            front: v.photo_front_url,
            rear: v.photo_rear_url,
            left: v.photo_left_url,
            right: v.photo_right_url,
            interior: v.photo_interior_url,
          },
          insurance: {
            url: v.insurance_doc_url,
            expiresAt: v.insurance_expires_at,
          },
          registration: {
            url: v.registration_doc_url,
            expiresAt: v.registration_expires_at,
          },
          verificationStatus: v.verification_status,
          verificationNote: v.verification_note,
          submittedAt: v.updated_at,
        };
      }),
    };
  }

  /** Approve or reject a mobile vehicle. A rejection must say why. */
  async reviewMobileVehicle(
    id: string,
    approved: boolean,
    note: string | undefined,
    actorId?: string,
  ) {
    const vehicle = await this.mobileVehicles.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const trimmed = (note ?? '').trim();
    if (!approved && !trimmed) {
      throw new BadRequestException(
        'A rejection needs a reason — the Voyager sees this note.',
      );
    }

    vehicle.verification_status = approved ? 'approved' : 'rejected';
    vehicle.verification_note = trimmed || null;
    await this.mobileVehicles.save(vehicle);

    await this.audit.save(
      this.audit.create({
        actor_id: actorId ?? null,
        action: approved ? 'mobile_vehicle.approved' : 'mobile_vehicle.rejected',
        entity_type: 'mobile_vehicle',
        entity_id: id,
        metadata: { note: trimmed || null, userId: vehicle.user_id },
      } as Partial<AuditEvent>),
    );

    return {
      ok: true,
      id,
      verificationStatus: vehicle.verification_status,
      verificationNote: vehicle.verification_note,
    };
  }
}
