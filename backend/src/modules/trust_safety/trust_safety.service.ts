import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  Report,
  ModerationAction,
  Suspension,
  Appeal,
} from '../../database/entities/safety.entities';
import { User } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entities';
import {
  SubmitReportDto,
  ModerationActionDto,
  SubmitAppealDto,
} from '../../common/dto/trust-safety.dto';
import {
  ReportCategory,
  ReportSeverity,
  ModerationActionType,
  AppealStatus,
  UserRole,
} from '../../common/enums';
import { PinoLogger } from 'nestjs-pino';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

const SEVERITY_MAP: Record<ReportCategory, ReportSeverity> = {
  sexual_misconduct: ReportSeverity.P0,
  weapons_threat: ReportSeverity.P0,
  criminal_allegations: ReportSeverity.P0,
  unsafe_driving: ReportSeverity.P1,
  harassment: ReportSeverity.P1,
  discrimination: ReportSeverity.P1,
  vehicle_condition: ReportSeverity.P2,
  no_show: ReportSeverity.P2,
  route_fraud: ReportSeverity.P2,
  minor_dispute: ReportSeverity.P2,
};

const SLA_HOURS: Record<ReportSeverity, number> = {
  P0: 1,
  P1: 24,
  P2: 72,
};

@Injectable()
export class TrustSafetyService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(ModerationAction)
    private readonly actionRepo: Repository<ModerationAction>,
    @InjectRepository(Suspension)
    private readonly suspensionRepo: Repository<Suspension>,
    @InjectRepository(Appeal)
    private readonly appealRepo: Repository<Appeal>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async submitReport(
    reporterId: string,
    dto: SubmitReportDto,
  ): Promise<Report> {
    const reportedUser = await this.userRepo.findOne({
      where: { id: dto.reported_user_id },
    });
    if (!reportedUser) throw new NotFoundException('Reported user not found');

    if (reporterId === dto.reported_user_id) {
      throw new BadRequestException('Cannot report yourself');
    }

    if (dto.booking_id) {
      const booking = await this.bookingRepo.findOne({
        where: { id: dto.booking_id },
        relations: ['trip'],
      });
      if (!booking) throw new NotFoundException('Booking not found');

      const isParticipant =
        booking.rider_id === reporterId ||
        booking.trip?.driver_id === reporterId;
      const reportedIsParticipant =
        booking.rider_id === dto.reported_user_id ||
        booking.trip?.driver_id === dto.reported_user_id;

      if (!isParticipant || !reportedIsParticipant) {
        throw new BadRequestException(
          'Report must involve users from the same booking',
        );
      }
    }

    const severity = SEVERITY_MAP[dto.category] || ReportSeverity.P2;
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + SLA_HOURS[severity]);

    const report = this.reportRepo.create({
      reporter_id: reporterId,
      reported_user_id: dto.reported_user_id,
      booking_id: dto.booking_id || null,
      category: dto.category,
      description: dto.description,
      evidence_photo_url: dto.evidence_photo_url || null,
      severity,
      sla_deadline: slaDeadline.toISOString(),
      status: 'pending',
    });

    const saved = await this.reportRepo.save(report);

    await this.audit.log({
      actor_id: reporterId,
      entity_type: 'report',
      entity_id: saved.id,
      event_type: 'report_submitted',
      payload: {
        category: dto.category,
        severity,
        reported_user_id: dto.reported_user_id,
        booking_id: dto.booking_id,
      },
    });

    if (severity === ReportSeverity.P0) {
      await this.placeUnderReview(dto.reported_user_id, saved.id);
    }

    const tsAgents = await this.userRepo.find({
      where: { role: UserRole.TS_AGENT },
    });
    for (const agent of tsAgents) {
      await this.notifications.sendPush(
        agent.id,
        severity === ReportSeverity.P0
          ? 'URGENT: P0 Safety Report'
          : 'New Safety Report',
        `Report #${saved.id.slice(0, 8)} — ${dto.category} — SLA: ${SLA_HOURS[severity]}hr`,
        {
          report_id: saved.id,
          severity,
          screen: `admin/moderation/${saved.id}`,
        },
      );
    }

    this.logger.info(
      { reportId: saved.id, reporterId, severity, category: dto.category },
      'Report submitted',
    );

    return saved;
  }

  async getModerationQueue(
    page = 1,
    limit = 50,
  ): Promise<{ reports: Report[]; total: number; sla_breached: number }> {
    const [reports, total] = await this.reportRepo.findAndCount({
      where: { status: In(['pending', 'under_review']) },
      order: { severity: 'ASC', sla_deadline: 'ASC' },
      relations: ['reporter', 'reported_user', 'booking'],
      skip: (page - 1) * limit,
      take: limit,
    });

    const now = new Date();
    const slaBreached = reports.filter(
      (r) => new Date(r.sla_deadline) < now,
    ).length;

    return { reports, total, sla_breached: slaBreached };
  }

  async getReportDetail(reportId: string): Promise<any> {
    const report = await this.reportRepo.findOne({
      where: { id: reportId },
      relations: ['reporter', 'reported_user', 'booking', 'booking.trip'],
    });

    if (!report) throw new NotFoundException('Report not found');

    const actions = await this.actionRepo.find({
      where: { report_id: reportId },
      relations: ['takenBy'],
      order: { created_at: 'ASC' },
    });

    const appeals = await this.appealRepo.find({
      where: { action_id: In(actions.map((a) => a.id)) },
      relations: ['user', 'reviewer'],
      order: { created_at: 'ASC' },
    });

    return {
      report,
      actions,
      appeals,
    };
  }

  async takeModerationAction(
    agentId: string,
    dto: ModerationActionDto,
    reqIp?: string,
    reqUa?: string,
  ): Promise<ModerationAction> {
    const agent = await this.userRepo.findOne({ where: { id: agentId } });
    if (
      !agent ||
      (agent.role !== UserRole.TS_AGENT && agent.role !== UserRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'Only T&S agents or admins can take moderation actions',
      );
    }

    const report = await this.reportRepo.findOne({
      where: { id: dto.report_id },
      relations: ['reported_user'],
    });
    if (!report) throw new NotFoundException('Report not found');

    if (report.status !== 'pending' && report.status !== 'under_review') {
      throw new BadRequestException('Report already resolved');
    }

    const action = this.actionRepo.create({
      report_id: dto.report_id,
      taken_by: agentId,
      action_type: dto.action_type,
      reason: dto.reason,
      evidence_refs: dto.evidence_refs || [],
      suspension_days: dto.suspension_days || null,
    });

    const saved = await this.actionRepo.save(action);

    await this.audit.log({
      actor_id: agentId,
      entity_type: 'moderation_action',
      entity_id: saved.id,
      event_type: 't&s_action',
      payload: {
        report_id: dto.report_id,
        action_type: dto.action_type,
        reason: dto.reason,
        reported_user_id: report.reported_user_id,
        suspension_days: dto.suspension_days,
      },
      ip_address: reqIp,
      user_agent: reqUa,
    });

    if (
      dto.action_type === ModerationActionType.TEMP_SUSPENSION &&
      dto.suspension_days
    ) {
      const suspension = this.suspensionRepo.create({
        user_id: report.reported_user_id,
        starts_at: new Date().toISOString(),
        ends_at: new Date(
          Date.now() + dto.suspension_days * 86400000,
        ).toISOString(),
        reason: dto.reason,
        moderation_action_id: saved.id,
      });
      await this.suspensionRepo.save(suspension);

      await this.userRepo.update(report.reported_user_id, {
        is_suspended: true,
      });

      await this.audit.log({
        actor_id: agentId,
        entity_type: 'suspension',
        entity_id: suspension.id,
        event_type: 'account_change',
        payload: {
          user_id: report.reported_user_id,
          suspension_days: dto.suspension_days,
          reason: dto.reason,
        },
      });
    }

    if (dto.action_type === ModerationActionType.PERMANENT_BAN) {
      await this.userRepo.update(report.reported_user_id, {
        is_banned: true,
        is_suspended: true,
      });

      await this.audit.log({
        actor_id: agentId,
        entity_type: 'user',
        entity_id: report.reported_user_id,
        event_type: 'account_change',
        payload: { action: 'permanent_ban', reason: dto.reason },
      });
    }

    if (dto.action_type === ModerationActionType.LAW_ENFORCEMENT_REFERRAL) {
      const founders = await this.userRepo.find({
        where: { role: UserRole.ADMIN },
      });
      for (const founder of founders) {
        await this.notifications.sendPush(
          founder.id,
          'LAW ENFORCEMENT REFERRAL',
          `Report #${report.id.slice(0, 8)} — DO NOT ACT until authorized by legal counsel`,
          { report_id: report.id, screen: `admin/moderation/${report.id}` },
        );
      }
    }

    report.status =
      dto.action_type === ModerationActionType.DISMISS
        ? 'dismissed'
        : 'resolved';
    report.resolved_at = new Date().toISOString();
    await this.reportRepo.save(report);

    if (dto.action_type === ModerationActionType.DISMISS) {
      await this.liftReview(report.reported_user_id);
    }

    await this.notifications.sendPush(
      report.reported_user_id,
      'Action Taken on Report',
      dto.action_type === ModerationActionType.DISMISS
        ? 'A report against you has been dismissed.'
        : `Action has been taken on a report against you. ${dto.action_type === ModerationActionType.PERMANENT_BAN ? 'No appeal available.' : 'You may submit an appeal.'}`,
      { report_id: report.id },
    );

    const reporter = await this.userRepo.findOne({
      where: { id: report.reporter_id },
    });
    if (reporter) {
      await this.notifications.sendPush(
        reporter.id,
        'Report Update',
        'Action has been taken on your report. Thank you for keeping Bovogo safe.',
        { report_id: report.id },
      );
    }

    return saved;
  }

  async submitAppeal(userId: string, dto: SubmitAppealDto): Promise<Appeal> {
    const action = await this.actionRepo.findOne({
      where: { id: dto.action_id },
      relations: ['report'],
    });
    if (!action) throw new NotFoundException('Moderation action not found');

    if (action.report.reported_user_id !== userId) {
      throw new ForbiddenException(
        'You can only appeal actions against yourself',
      );
    }

    if (action.action_type === ModerationActionType.PERMANENT_BAN) {
      throw new BadRequestException('Permanent bans cannot be appealed');
    }

    const existingAppeal = await this.appealRepo.findOne({
      where: { user_id: userId, action_id: dto.action_id },
    });
    if (existingAppeal) {
      throw new BadRequestException('You have already appealed this action');
    }

    const appeal = this.appealRepo.create({
      user_id: userId,
      action_id: dto.action_id,
      reason: dto.reason,
      evidence_url: dto.evidence_url || null,
      status: AppealStatus.PENDING,
    });

    const saved = await this.appealRepo.save(appeal);

    await this.audit.log({
      actor_id: userId,
      entity_type: 'appeal',
      entity_id: saved.id,
      event_type: 'appeal_action',
      payload: { action_id: dto.action_id, reason: dto.reason },
    });

    const availableAgents = await this.userRepo.find({
      where: { role: UserRole.TS_AGENT },
    });

    const originalAgent = action.taken_by;
    const differentAgent = availableAgents.find((a) => a.id !== originalAgent);
    const assignedAgent =
      differentAgent ||
      (availableAgents.length > 0 ? availableAgents[0] : null);

    if (assignedAgent) {
      await this.notifications.sendPush(
        assignedAgent.id,
        'New Appeal Submitted',
        `Appeal #${saved.id.slice(0, 8)} for action by agent ${originalAgent.slice(0, 8)}`,
        { appeal_id: saved.id, screen: `admin/appeals/${saved.id}` },
      );
    }

    return saved;
  }

  async reviewAppeal(
    agentId: string,
    appealId: string,
    decision: 'granted' | 'denied',
    decisionReason: string,
  ): Promise<Appeal> {
    const agent = await this.userRepo.findOne({ where: { id: agentId } });
    if (
      !agent ||
      (agent.role !== UserRole.TS_AGENT && agent.role !== UserRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'Only T&S agents or admins can review appeals',
      );
    }

    const appeal = await this.appealRepo.findOne({
      where: { id: appealId },
      relations: ['action', 'action.report'],
    });
    if (!appeal) throw new NotFoundException('Appeal not found');

    if (appeal.status !== AppealStatus.PENDING) {
      throw new BadRequestException('Appeal already reviewed');
    }

    const action = appeal.action;

    const differentAgent = action.taken_by !== agentId;
    if (!differentAgent && agent.role !== UserRole.ADMIN) {
      throw new ForbiddenException('A different agent must review this appeal');
    }

    appeal.status =
      decision === 'granted' ? AppealStatus.GRANTED : AppealStatus.DENIED;
    appeal.reviewed_by = agentId;
    appeal.decision = decisionReason;
    appeal.reviewed_at = new Date().toISOString();
    await this.appealRepo.save(appeal);

    await this.audit.log({
      actor_id: agentId,
      entity_type: 'appeal',
      entity_id: appealId,
      event_type: 'appeal_action',
      payload: { decision, decision_reason: decisionReason },
    });

    if (decision === 'granted') {
      if (action.action_type === ModerationActionType.TEMP_SUSPENSION) {
        await this.suspensionRepo.update(
          { user_id: appeal.user_id, moderation_action_id: action.id },
          { ends_at: new Date().toISOString() },
        );
      }

      await this.userRepo.update(appeal.user_id, { is_suspended: false });
      await this.liftReview(appeal.user_id);
    }

    await this.notifications.sendPush(
      appeal.user_id,
      `Appeal ${decision === 'granted' ? 'Approved' : 'Denied'}`,
      decisionReason,
      { appeal_id: appealId },
    );

    return appeal;
  }

  async getMyReports(userId: string): Promise<Report[]> {
    return this.reportRepo.find({
      where: [{ reporter_id: userId }, { reported_user_id: userId }],
      order: { created_at: 'DESC' },
    });
  }

  async getUserAppeals(userId: string): Promise<Appeal[]> {
    return this.appealRepo.find({
      where: { user_id: userId },
      relations: ['action', 'action.report'],
      order: { created_at: 'DESC' },
    });
  }

  async isUserSuspended(
    userId: string,
  ): Promise<{ suspended: boolean; suspension?: Suspension }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user?.is_banned) {
      return { suspended: true };
    }

    const activeSuspension = await this.suspensionRepo.findOne({
      where: { user_id: userId },
      order: { ends_at: 'DESC' },
    });

    if (activeSuspension && new Date(activeSuspension.ends_at) > new Date()) {
      return { suspended: true, suspension: activeSuspension };
    }

    if (user?.is_suspended) {
      await this.userRepo.update(userId, { is_suspended: false });
    }

    return { suspended: false };
  }

  private async placeUnderReview(
    userId: string,
    reportId: string,
  ): Promise<void> {
    await this.userRepo.update(userId, { is_under_review: true });

    await this.audit.log({
      actor_id: 'system',
      entity_type: 'user',
      entity_id: userId,
      event_type: 'account_change',
      payload: { action: 'placed_under_review', report_id: reportId },
    });
  }

  private async liftReview(userId: string): Promise<void> {
    await this.userRepo.update(userId, { is_under_review: false });

    await this.audit.log({
      actor_id: 'system',
      entity_type: 'user',
      entity_id: userId,
      event_type: 'account_change',
      payload: { action: 'review_lifted' },
    });
  }
}
