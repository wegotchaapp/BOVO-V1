import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Verification } from '../../database/entities/identity.entities';
import { User } from '../../database/entities/user.entity';
import { Incident } from '../../database/entities/safety.entities';
import { VerificationStatus } from '../../common/enums';
import { PinoLogger } from 'nestjs-pino';
import Stripe from 'stripe';

const RE_VERIFICATION_MONTHS = 24;

@Injectable()
export class IdentityService {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Incident)
    private readonly incidentRepo: Repository<Incident>,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
      apiVersion: '2025-02-24.acacia',
    });
    this.webhookSecret =
      this.config.get<string>('STRIPE_IDENTITY_WEBHOOK_SECRET') || '';
  }

  async startVerification(
    userId: string,
  ): Promise<{ client_secret: string; session_id: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.getLatestVerification(userId);
    if (existing?.status === VerificationStatus.VERIFIED) {
      if (!this.isExpired(existing)) {
        throw new BadRequestException('Identity already verified');
      }
      existing.status = VerificationStatus.EXPIRED;
      await this.verificationRepo.save(existing);
    }

    const session = await this.stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { user_id: userId },
    });

    const verification = this.verificationRepo.create({
      user_id: userId,
      provider_reference: session.id,
      status: VerificationStatus.PENDING,
    });
    await this.verificationRepo.save(verification);

    this.logger.info(
      { userId, sessionId: session.id },
      'Verification session created',
    );

    return {
      client_secret: session.client_secret as string,
      session_id: session.id,
    };
  }

  async handleVerificationWebhook(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Identity.VerificationSession;
    const userId = session.metadata?.user_id;

    if (!userId) {
      this.logger.warn(
        { sessionId: session.id },
        'Webhook missing user_id metadata',
      );
      return;
    }

    const verification = await this.verificationRepo.findOne({
      where: { provider_reference: session.id },
    });

    if (!verification) {
      this.logger.warn(
        { sessionId: session.id },
        'Verification record not found for webhook',
      );
      return;
    }

    switch (event.type) {
      case 'identity.verification_session.verified':
        await this.handleVerified(verification, session, userId);
        break;

      case 'identity.verification_session.requires_input':
        await this.handleRequiresInput(verification);
        break;

      case 'identity.verification_session.canceled':
        await this.handleCanceled(verification);
        break;

      default:
        this.logger.info(
          { eventType: event.type, sessionId: session.id },
          'Unhandled identity webhook type',
        );
    }
  }

  async getStatus(userId: string): Promise<{
    status: string;
    is_verified: boolean;
    needs_reverification: boolean;
    expires_at: string | null;
    last_verified_at: string | null;
  }> {
    const verification = await this.getLatestVerification(userId);

    if (!verification) {
      return {
        status: 'not_started',
        is_verified: false,
        needs_reverification: false,
        expires_at: null,
        last_verified_at: null,
      };
    }

    if (
      verification.status === VerificationStatus.VERIFIED &&
      this.isExpired(verification)
    ) {
      verification.status = VerificationStatus.EXPIRED;
      await this.verificationRepo.save(verification);

      return {
        status: 'expired',
        is_verified: false,
        needs_reverification: true,
        expires_at: verification.expires_at,
        last_verified_at: verification.completed_at,
      };
    }

    return {
      status: verification.status,
      is_verified: verification.status === VerificationStatus.VERIFIED,
      needs_reverification:
        verification.status === VerificationStatus.VERIFIED &&
        this.isExpiringSoon(verification),
      expires_at: verification.expires_at,
      last_verified_at: verification.completed_at,
    };
  }

  async getFaceImageReference(userId: string): Promise<string | null> {
    const verification = await this.getLatestVerification(userId);
    return verification?.face_image_reference || null;
  }

  getWebhookSecret(): string {
    return this.webhookSecret;
  }

  private async handleVerified(
    verification: Verification,
    session: Stripe.Identity.VerificationSession,
    userId: string,
  ): Promise<void> {
    verification.status = VerificationStatus.VERIFIED;
    verification.completed_at = new Date().toISOString();

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + RE_VERIFICATION_MONTHS);
    verification.expires_at = expiresAt.toISOString();

    const provided = session.provided_details as any;
    if (provided) {
      verification.verified_name = provided?.first_name
        ? `${provided.first_name} ${provided.last_name || ''}`.trim()
        : null;
      verification.verified_dob = provided?.dob
        ? `${provided.dob.year}-${String(provided.dob.month).padStart(2, '0')}-${String(provided.dob.day).padStart(2, '0')}`
        : null;

      const outputs = session.verified_outputs as any;
      const faceImage = outputs?.document?.face_image?.id;
      if (faceImage) {
        verification.face_image_reference = faceImage;
      }
    }

    await this.verificationRepo.save(verification);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user) {
      const mismatch = this.checkNameDobMismatch(user, verification);
      if (mismatch) {
        await this.createMismatchIncident(userId, verification, mismatch);
        this.logger.warn(
          { userId, mismatch },
          'ID verification mismatch flagged for review',
        );
      }
    }

    this.logger.info(
      { userId, sessionId: session.id },
      'User identity verified',
    );
  }

  private async handleRequiresInput(verification: Verification): Promise<void> {
    verification.status = VerificationStatus.REQUIRES_INPUT;
    await this.verificationRepo.save(verification);

    this.logger.info(
      {
        userId: verification.user_id,
        sessionId: verification.provider_reference,
      },
      'Verification requires user input',
    );
  }

  private async handleCanceled(verification: Verification): Promise<void> {
    verification.status = VerificationStatus.FAILED;
    verification.completed_at = new Date().toISOString();
    await this.verificationRepo.save(verification);

    this.logger.info(
      {
        userId: verification.user_id,
        sessionId: verification.provider_reference,
      },
      'Verification canceled by user',
    );
  }

  private checkNameDobMismatch(
    user: User,
    verification: Verification,
  ): string | null {
    if (verification.verified_name && user.name) {
      const userName = user.name.toLowerCase().trim();
      const verifiedName = verification.verified_name.toLowerCase().trim();

      if (
        userName !== verifiedName &&
        !this.namesSimilar(userName, verifiedName)
      ) {
        return `Name mismatch: account="${user.name}" vs verified="${verification.verified_name}"`;
      }
    }

    if (verification.verified_dob && user.dob) {
      const accountDob = new Date(user.dob).toISOString().split('T')[0];
      const verifiedDob = verification.verified_dob;

      if (accountDob !== verifiedDob) {
        return `DOB mismatch: account="${accountDob}" vs verified="${verifiedDob}"`;
      }
    }

    return null;
  }

  private namesSimilar(name1: string, name2: string): boolean {
    const parts1 = name1.split(/\s+/);
    const parts2 = name2.split(/\s+/);

    if (parts1.length === 0 || parts2.length === 0) return false;

    const lastName1 = parts1[parts1.length - 1];
    const lastName2 = parts2[parts2.length - 1];
    const firstName1 = parts1[0];
    const firstName2 = parts2[0];

    return lastName1 === lastName2 && firstName1 === firstName2;
  }

  private async createMismatchIncident(
    userId: string,
    verification: Verification,
    reason: string,
  ): Promise<void> {
    const incident = this.incidentRepo.create({
      user_id: userId,
      booking_id: null,
      severity: 'P1',
      description: `ID verification mismatch — ${reason}. Session: ${verification.provider_reference}`,
      status: 'open',
    });
    await this.incidentRepo.save(incident);
  }

  private async getLatestVerification(
    userId: string,
  ): Promise<Verification | null> {
    return this.verificationRepo.findOne({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  private isExpired(verification: Verification): boolean {
    if (!verification.expires_at) return false;
    return new Date(verification.expires_at) < new Date();
  }

  private isExpiringSoon(verification: Verification): boolean {
    if (!verification.expires_at) return false;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return (
      new Date(verification.expires_at).getTime() - Date.now() < thirtyDays
    );
  }
}
