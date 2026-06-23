import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BackgroundCheck } from '../../database/entities/identity.entities';
import { User } from '../../database/entities/user.entity';
import { BackgroundCheckStatus } from '../../common/enums';
import { PinoLogger } from 'nestjs-pino';
import { createHash } from 'crypto';
import { AdverseActionService } from './adverse-action.service';
import { AuditService } from '../audit/audit.service';

export interface FcraConsentDto {
  ip_address: string;
  user_agent: string;
}

export interface BackgroundCheckInitDto {
  legal_first_name: string;
  legal_last_name: string;
  ssn: string;
  dob: string;
  email: string;
  driver_license_number?: string;
  driver_license_state?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipcode: string;
  };
  fcra_consent: FcraConsentDto;
  authorization_accepted_at: string;
}

@Injectable()
export class CheckrService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.checkr.com/v1';
  private readonly packageId = 'driver_pro';

  constructor(
    @InjectRepository(BackgroundCheck)
    private readonly bgCheckRepo: Repository<BackgroundCheck>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
    private readonly adverseAction: AdverseActionService,
    private readonly auditService: AuditService,
  ) {
    this.apiKey = this.config.get<string>('CHECKR_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('CHECKR_API_KEY not configured');
    }
  }

  async acceptFcraDisclosure(
    userId: string,
    dto: FcraConsentDto,
  ): Promise<{ consent_recorded: true; accepted_at: string }> {
    const acceptedAt = new Date().toISOString();

    await this.auditService.log({
      actor_id: userId,
      entity_type: 'fcra_consent',
      entity_id: userId,
      event_type: 'fcra_disclosure_accepted',
      payload: {
        ip_address: dto.ip_address,
        user_agent: dto.user_agent,
        accepted_at: acceptedAt,
        disclosure_version: '1.0',
      },
      ip_address: dto.ip_address,
      user_agent: dto.user_agent,
    });

    this.logger.info(
      { userId, ip: dto.ip_address, acceptedAt },
      'FCRA disclosure accepted',
    );
    return { consent_recorded: true, accepted_at: acceptedAt };
  }

  private get isMockMode(): boolean {
    return !this.apiKey || this.apiKey.includes('mock') || this.apiKey.length < 10;
  }

  async initiateBackgroundCheck(
    userId: string,
    dto: BackgroundCheckInitDto,
  ): Promise<{ check_id: string; invitation_url: string; status: string }> {
    const existing = await this.bgCheckRepo.findOne({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    if (existing && existing.status === 'clear') {
      throw new ConflictException(
        'You already have an approved background check',
      );
    }

    if (existing && existing.status === 'pending') {
      throw new ConflictException(
        'A background check is already in progress',
      );
    }

    const ssnHashSuffix = createHash('sha256')
      .update(dto.ssn.slice(-4))
      .digest('hex')
      .slice(0, 8);

    const duplicate = await this.bgCheckRepo.findOne({
      where: { ssn_hash_suffix: ssnHashSuffix },
    });

    if (duplicate) {
      this.logger.warn(
        { userId, ssnHashSuffix },
        'SSN suffix matches existing candidate — possible duplicate',
      );
    }

    if (this.isMockMode) {
      const bgCheck = this.bgCheckRepo.create({
        user_id: userId,
        checkr_candidate_id: 'mock_candidate',
        checkr_package: this.packageId,
        invitation_url: '',
        ssn_hash_suffix: ssnHashSuffix,
        status: BackgroundCheckStatus.CLEAR,
        fcra_disclosure_accepted_at: new Date().toISOString(),
        user_authorization_accepted_at: dto.authorization_accepted_at,
        initiated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        annual_recheck_scheduled: false,
      });

      const saved = await this.bgCheckRepo.save(bgCheck);

      await this.userRepo.update(userId, {
        background_check_status: 'approved',
      });

      this.logger.info(
        { userId },
        'Background check auto-approved (mock mode)',
      );

      return {
        check_id: saved.id,
        invitation_url: '',
        status: 'clear',
      };
    }

    const checkrCandidate = await this.createCheckrCandidate(dto);
    const invitation = await this.createCheckrInvitation(
      checkrCandidate.id,
      dto.email,
    );

    const bgCheck = this.bgCheckRepo.create({
      user_id: userId,
      checkr_candidate_id: checkrCandidate.id,
      checkr_package: this.packageId,
      invitation_url: invitation.invitation_url,
      ssn_hash_suffix: ssnHashSuffix,
      status: BackgroundCheckStatus.PENDING,
      fcra_disclosure_accepted_at: new Date().toISOString(),
      user_authorization_accepted_at: dto.authorization_accepted_at,
      initiated_at: new Date().toISOString(),
      annual_recheck_scheduled: false,
    });

    const saved = await this.bgCheckRepo.save(bgCheck);

    this.logger.info(
      {
        userId,
        candidateId: checkrCandidate.id,
        invitationId: invitation.id,
      },
      'Background check initiated',
    );

    return {
      check_id: saved.id,
      invitation_url: invitation.invitation_url,
      status: 'pending',
    };
  }

  async getStatus(userId: string): Promise<{
    status: string;
    completed_at: string | null;
    last_check_date: string | null;
    expires_at: string | null;
    invitation_url: string | null;
    adverse_deadline: string | null;
  }> {
    const bgCheck = await this.bgCheckRepo.findOne({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    if (!bgCheck) {
      return {
        status: 'not_started',
        completed_at: null,
        last_check_date: null,
        expires_at: null,
        invitation_url: null,
        adverse_deadline: null,
      };
    }

    const expiresAt = bgCheck.completed_at
      ? new Date(
          new Date(bgCheck.completed_at).setFullYear(
            new Date(bgCheck.completed_at).getFullYear() + 1,
          ),
        ).toISOString()
      : null;

    return {
      status: bgCheck.status,
      completed_at: bgCheck.completed_at,
      last_check_date: bgCheck.completed_at,
      expires_at: expiresAt,
      invitation_url: bgCheck.invitation_url,
      adverse_deadline: bgCheck.adverse_action_deadline,
    };
  }

  async handleWebhookReportCompleted(
    reportId: string,
    candidateId: string,
    reportStatus: string,
    adjudication?: string,
  ): Promise<void> {
    const bgCheck = await this.bgCheckRepo.findOne({
      where: { checkr_candidate_id: candidateId },
      relations: ['user'],
    });

    if (!bgCheck) {
      this.logger.error(
        { candidateId, reportId },
        'No background check found for Checkr candidate',
      );
      return;
    }

    const effectiveStatus = adjudication || reportStatus;

    this.logger.info(
      {
        userId: bgCheck.user_id,
        candidateId,
        reportStatus,
        adjudication,
        effectiveStatus,
      },
      'Checkr report completed',
    );

    switch (effectiveStatus) {
      case 'clear':
        await this.handleClearResult(bgCheck);
        break;
      case 'consider':
        await this.handleConsiderResult(bgCheck);
        break;
      case 'adverse':
        await this.handleAdverseResult(bgCheck);
        break;
      default:
        this.logger.warn(
          { candidateId, effectiveStatus },
          'Unknown report adjudication status',
        );
    }
  }

  async scheduleRecheck(bgCheck: BackgroundCheck): Promise<void> {
    if (bgCheck.annual_recheck_scheduled) {
      return;
    }

    bgCheck.annual_recheck_scheduled = true;
    await this.bgCheckRepo.save(bgCheck);

    this.logger.info(
      {
        userId: bgCheck.user_id,
        candidateId: bgCheck.checkr_candidate_id,
      },
      'Annual re-check scheduled',
    );
  }

  async getChecksDueForRecheck(): Promise<BackgroundCheck[]> {
    const thirtyDaysBeforeExpiry = new Date();
    thirtyDaysBeforeExpiry.setFullYear(thirtyDaysBeforeExpiry.getFullYear() + 1);
    thirtyDaysBeforeExpiry.setDate(thirtyDaysBeforeExpiry.getDate() - 30);

    return this.bgCheckRepo
      .createQueryBuilder('bg')
      .where('bg.status = :status', { status: 'clear' })
      .andWhere('bg.completed_at <= :threshold', {
        threshold: thirtyDaysBeforeExpiry.toISOString(),
      })
      .andWhere('bg.annual_recheck_scheduled = true')
      .leftJoinAndSelect('bg.user', 'user')
      .getMany();
  }

  private async createCheckrCandidate(
    dto: BackgroundCheckInitDto,
  ): Promise<{ id: string }> {
    const response = await fetch(`${this.baseUrl}/candidates`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        first_name: dto.legal_first_name,
        last_name: dto.legal_last_name,
        email: dto.email,
        dob: dto.dob,
        ssn: dto.ssn,
        driver_license_number: dto.driver_license_number,
        driver_license_state: dto.driver_license_state,
        address: {
          street: dto.address.street,
          city: dto.address.city,
          state: dto.address.state,
          zipcode: dto.address.zipcode,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      this.logger.error(
        { status: response.status, error },
        'Failed to create Checkr candidate',
      );
      throw new BadRequestException(
        `Checkr API error: ${error.error?.message || 'Unknown error'}`,
      );
    }

    return response.json();
  }

  private async createCheckrInvitation(
    candidateId: string,
    email: string,
  ): Promise<{ id: string; invitation_url: string }> {
    const response = await fetch(`${this.baseUrl}/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidate_id: candidateId,
        package: this.packageId,
        invite_recipient_email: email,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      this.logger.error(
        { status: response.status, error },
        'Failed to create Checkr invitation',
      );
      throw new BadRequestException(
        `Checkr API error: ${error.error?.message || 'Unknown error'}`,
      );
    }

    return response.json();
  }

  private async handleClearResult(bgCheck: BackgroundCheck): Promise<void> {
    bgCheck.status = BackgroundCheckStatus.CLEAR;
    bgCheck.completed_at = new Date().toISOString();
    await this.bgCheckRepo.save(bgCheck);

    await this.userRepo.update(bgCheck.user_id, {
      background_check_status: 'approved',
    });

    this.logger.info(
      { userId: bgCheck.user_id },
      'Background check cleared — driver approved',
    );

    await this.adverseAction.sendClearNotification(
      bgCheck.user,
    );

    await this.scheduleRecheck(bgCheck);
  }

  private async handleConsiderResult(bgCheck: BackgroundCheck): Promise<void> {
    bgCheck.status = BackgroundCheckStatus.CONSIDER;
    bgCheck.completed_at = new Date().toISOString();
    await this.bgCheckRepo.save(bgCheck);

    this.logger.info(
      { userId: bgCheck.user_id },
      'Background check marked for manual review',
    );

    await this.adverseAction.sendConsiderNotification(bgCheck.user);
  }

  private async handleAdverseResult(bgCheck: BackgroundCheck): Promise<void> {
    bgCheck.status = BackgroundCheckStatus.ADVERSE;
    bgCheck.completed_at = new Date().toISOString();

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 5);
    bgCheck.adverse_action_deadline = deadline.toISOString();

    await this.bgCheckRepo.save(bgCheck);

    this.logger.info(
      { userId: bgCheck.user_id, deadline: bgCheck.adverse_action_deadline },
      'Background check adverse — initiating adverse action process',
    );

    await this.adverseAction.sendPreAdverseNotice(
      bgCheck.user,
      bgCheck.id,
      bgCheck.checkr_candidate_id,
    );

    await this.adverseAction.scheduleFinalAdverseNotice(bgCheck);
  }
}
