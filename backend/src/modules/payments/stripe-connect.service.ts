import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { User } from '../../database/entities/user.entity';
import { Payout } from '../../database/entities/payment.entities';
import { ComplianceLog } from '../../database/entities/payment.entities';
import { Trip } from '../../database/entities/trip.entities';

export interface StripeOnboardDto {
  return_url: string;
  refresh_url: string;
  email?: string;
}

export interface StripeConnectStatus {
  stripe_account_id: string | null;
  details_submitted: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  is_onboarded: boolean;
  requires_action: string[];
  account_link_url: string | null;
}

@Injectable()
export class StripeConnectService {
  private readonly apiKey: string;
  private readonly webhookSecret: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    @InjectRepository(ComplianceLog)
    private readonly complianceRepo: Repository<ComplianceLog>,
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.apiKey = this.config.get<string>('STRIPE_SECRET_KEY') || '';
    this.webhookSecret = this.config.get<string>('STRIPE_CONNECT_WEBHOOK_SECRET') || '';

    if (!this.apiKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured');
    }
  }

  async onboardDriver(
    userId: string,
    dto: StripeOnboardDto,
  ): Promise<{ account_id: string; account_link_url: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.stripe_account_id) {
      const status = await this.getConnectStatus(userId);
      if (status.is_onboarded) {
        throw new BadRequestException('Driver is already fully onboarded');
      }
      const link = await this.refreshAccountLink(userId, dto.return_url, dto.refresh_url);
      return { account_id: user.stripe_account_id, account_link_url: link.account_link_url };
    }

    const account = await this.createStripeAccount(user);

    user.stripe_account_id = account.id;
    user.stripe_charges_enabled = false;
    user.stripe_payouts_enabled = false;
    user.stripe_details_submitted = false;
    await this.userRepo.save(user);

    const accountLink = await this.createAccountLink(
      account.id,
      dto.return_url,
      dto.refresh_url,
    );

    this.logger.info(
      { userId, stripeAccountId: account.id },
      'Stripe Connect Express account created',
    );

    return {
      account_id: account.id,
      account_link_url: accountLink.url,
    };
  }

  async getConnectStatus(userId: string): Promise<StripeConnectStatus> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const requiresAction: string[] = [];

    if (!user.stripe_account_id) {
      requiresAction.push('create_account');
      return {
        stripe_account_id: null,
        details_submitted: false,
        charges_enabled: false,
        payouts_enabled: false,
        is_onboarded: false,
        requires_action: requiresAction,
        account_link_url: null,
      };
    }

    try {
      const account = await this.retrieveStripeAccount(user.stripe_account_id);

      user.stripe_charges_enabled = account.charges_enabled || false;
      user.stripe_payouts_enabled = account.payouts_enabled || false;
      user.stripe_details_submitted = account.details_submitted || false;
      await this.userRepo.save(user);

      if (!account.details_submitted) requiresAction.push('complete_details');
      if (!account.external_accounts?.data?.length) requiresAction.push('add_bank_account');
      if (!account.tos_acceptance?.date) requiresAction.push('accept_terms');

      let accountLinkUrl: string | null = null;
      if (requiresAction.length > 0) {
        try {
          const link = await this.createAccountLink(
            user.stripe_account_id,
            `${this.config.get('APP_URL', 'https://bovogo.com')}/onboarding/return`,
            `${this.config.get('APP_URL', 'https://bovogo.com')}/onboarding/refresh`,
          );
          accountLinkUrl = link.url;
        } catch {
        }
      }

      const isOnboarded =
        account.details_submitted &&
        account.charges_enabled &&
        account.payouts_enabled;

      return {
        stripe_account_id: user.stripe_account_id,
        details_submitted: account.details_submitted || false,
        charges_enabled: account.charges_enabled || false,
        payouts_enabled: account.payouts_enabled || false,
        is_onboarded: isOnboarded,
        requires_action: requiresAction,
        account_link_url: accountLinkUrl,
      };
    } catch (error) {
      this.logger.error(
        { userId, error },
        'Failed to retrieve Stripe account',
      );
      return {
        stripe_account_id: user.stripe_account_id,
        details_submitted: false,
        charges_enabled: false,
        payouts_enabled: false,
        is_onboarded: false,
        requires_action: ['fetch_error'],
        account_link_url: null,
      };
    }
  }

  async refreshAccountLink(
    userId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<{ account_link_url: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.stripe_account_id) {
      throw new BadRequestException('No Stripe account exists for this user');
    }

    const accountLink = await this.createAccountLink(
      user.stripe_account_id,
      returnUrl,
      refreshUrl,
    );

    return { account_link_url: accountLink.url };
  }

  async getDashboardLink(userId: string): Promise<{ url: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.stripe_account_id) {
      throw new BadRequestException('No Stripe account exists for this user');
    }

    const loginLink = await this.createLoginLink(user.stripe_account_id);

    this.logger.info(
      { userId, stripeAccountId: user.stripe_account_id },
      'Stripe Express dashboard link generated',
    );

    return { url: loginLink.url };
  }

  async handleWebhookAccountUpdated(
    accountId: string,
    data: Record<string, any>,
  ): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { stripe_account_id: accountId },
    });

    if (!user) {
      this.logger.warn(
        { accountId },
        'account.updated webhook for unknown account',
      );
      return;
    }

    user.stripe_charges_enabled = data.charges_enabled || false;
    user.stripe_payouts_enabled = data.payouts_enabled || false;
    user.stripe_details_submitted = data.details_submitted || false;
    await this.userRepo.save(user);

    this.logger.info(
      {
        userId: user.id,
        chargesEnabled: data.charges_enabled,
        payoutsEnabled: data.payouts_enabled,
      },
      'Stripe account status synced',
    );

    if (data.payouts_enabled && !user.stripe_payouts_enabled) {
      this.logger.info(
        { userId: user.id },
        'Driver payouts now enabled',
      );
    }
  }

  async handleWebhookPaymentIntentSucceeded(
    paymentIntent: Record<string, any>,
  ): Promise<void> {
    const metadata = paymentIntent.metadata || {};
    const bookingId = metadata.booking_id;
    const driverId = metadata.driver_id;

    if (!bookingId || !driverId) {
      this.logger.warn(
        { paymentIntentId: paymentIntent.id },
        'PaymentIntent succeeded without booking/driver metadata',
      );
      return;
    }

    this.logger.info(
      { bookingId, driverId, amount: paymentIntent.amount },
      'PaymentIntent succeeded — logged',
    );
  }

  async handleWebhookTransferCreated(
    transfer: Record<string, any>,
  ): Promise<void> {
    const metadata = transfer.metadata || {};
    const driverId = metadata.driver_id;

    if (!driverId) return;

    const existing = await this.payoutRepo.findOne({
      where: { stripe_transfer_id: transfer.id },
    });

    if (existing) return;

    const payout = this.payoutRepo.create({
      driver_id: driverId,
      stripe_transfer_id: transfer.id,
      amount: (transfer.amount || 0) / 100,
      currency: transfer.currency || 'usd',
      status: transfer.status || 'pending',
      dispatched_at: transfer.created
        ? new Date(transfer.created * 1000).toISOString()
        : null,
    });

    await this.payoutRepo.save(payout);

    const user = await this.userRepo.findOne({ where: { id: driverId } });
    if (user) {
      const ytd = parseFloat(user.ytd_earnings.toString()) + payout.amount;
      const lifetime = parseFloat(user.lifetime_earnings.toString()) + payout.amount;
      user.ytd_earnings = parseFloat(ytd.toFixed(2));
      user.lifetime_earnings = parseFloat(lifetime.toFixed(2));
      user.last_payout_at = new Date().toISOString();

      if (!user.tax_notification_5k_sent && user.ytd_earnings >= 5000) {
        user.tax_notification_5k_sent = true;
        this.logger.info(
          { userId: driverId, ytdEarnings: user.ytd_earnings },
          '1099-K threshold notification queued ($5,000)',
        );
      }

      await this.userRepo.save(user);
    }

    this.logger.info(
      { driverId, transferId: transfer.id, amount: payout.amount },
      'Payout logged from transfer.created webhook',
    );
  }

  async getMyPayouts(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    payouts: Payout[];
    total: number;
    page: number;
    hasMore: boolean;
  }> {
    const [payouts, total] = await this.payoutRepo.findAndCount({
      where: { driver_id: userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['driver'],
    });

    return {
      payouts,
      total,
      page,
      hasMore: page * limit < total,
    };
  }

  async getMyEarnings(userId: string): Promise<{
    this_week: number;
    this_month: number;
    ytd: number;
    pending: number;
    lifetime: number;
  }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'ytd_earnings', 'lifetime_earnings'],
    });

    if (!user) throw new NotFoundException('User not found');

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [weeklyResult, monthlyResult, pendingResult] = await Promise.all([
      this.payoutRepo
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount), 0)', 'total')
        .where('p.driver_id = :userId', { userId })
        .andWhere('p.created_at >= :start', { start: startOfWeek.toISOString() })
        .getRawOne(),
      this.payoutRepo
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount), 0)', 'total')
        .where('p.driver_id = :userId', { userId })
        .andWhere('p.created_at >= :start', { start: startOfMonth.toISOString() })
        .getRawOne(),
      this.payoutRepo
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.amount), 0)', 'total')
        .where('p.driver_id = :userId', { userId })
        .andWhere('p.status = :status', { status: 'pending' })
        .getRawOne(),
    ]);

    return {
      this_week: parseFloat(weeklyResult?.total || '0'),
      this_month: parseFloat(monthlyResult?.total || '0'),
      ytd: parseFloat(user.ytd_earnings.toString()),
      pending: parseFloat(pendingResult?.total || '0'),
      lifetime: parseFloat(user.lifetime_earnings.toString()),
    };
  }

  async getYtdThresholdStatus(userId: string): Promise<{
    ytd_earnings: number;
    alert_6th_trip: boolean;
    alert_20k: boolean;
    alert_50k: boolean;
    trips_this_week: number;
  }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'ytd_earnings'],
    });

    if (!user) throw new NotFoundException('User not found');

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const tripsThisWeek = await this.tripRepo.count({
      where: {
        driver_id: userId,
        created_at: `>= ${startOfWeek.toISOString()}`,
      },
    });

    const ytd = parseFloat(user.ytd_earnings.toString());

    return {
      ytd_earnings: ytd,
      alert_6th_trip: tripsThisWeek >= 5,
      alert_20k: ytd >= 20000,
      alert_50k: ytd >= 50000,
      trips_this_week: tripsThisWeek,
    };
  }

  async checkTripComplianceGuardrail(
    userId: string,
  ): Promise<{ allowed: boolean; reason: string | null }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const tripCount = await this.tripRepo.count({
      where: {
        driver_id: userId,
        created_at: `>= ${sevenDaysAgo.toISOString()}`,
      },
    });

    if (tripCount >= 6) {
      const log = this.complianceRepo.create({
        user_id: userId,
        rule: 'trip_frequency_limit',
        action: 'blocked',
        details: `Driver attempted to post trip #${tripCount + 1} in 7 days (limit: 6)`,
        triggered_at: new Date().toISOString(),
      });
      await this.complianceRepo.save(log);

      return {
        allowed: false,
        reason: `You have posted ${tripCount} trips in the last 7 days. The cost-share compliance limit is 6 trips per 7-day period.`,
      };
    }

    if (tripCount >= 5) {
      const existing = await this.complianceRepo.findOne({
        where: {
          user_id: userId,
          rule: 'trip_frequency_warning',
          details: `5 trips posted this week`,
        },
      });

      if (!existing) {
        const log = this.complianceRepo.create({
          user_id: userId,
          rule: 'trip_frequency_warning',
          action: 'warned',
          details: `Driver at 5/6 trips this week — approaching compliance limit`,
          triggered_at: new Date().toISOString(),
        });
        await this.complianceRepo.save(log);

        this.logger.info(
          { userId, tripCount },
          'Compliance warning: driver approaching 6-trip limit',
        );
      }
    }

    return { allowed: true, reason: null };
  }

  private async createStripeAccount(user: User): Promise<any> {
    const body = new URLSearchParams();
    body.set('type', 'express');
    body.set('country', 'US');
    body.set('email', user.email);
    body.set('capabilities[card_payments][requested]', 'true');
    body.set('capabilities[transfers][requested]', 'true');
    body.set('business_type', 'individual');
    body.set('metadata[platform]', 'wegotcha');
    body.set('metadata[user_id]', user.id);

    const response = await fetch('https://api.stripe.com/v1/accounts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-10-28.acacia',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      this.logger.error(
        { status: response.status, error },
        'Stripe account creation failed',
      );
      throw new InternalServerErrorException(
        `Stripe API error: ${error.error?.message || 'Unknown error'}`,
      );
    }

    return response.json();
  }

  private async createAccountLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<any> {
    const body = new URLSearchParams();
    body.set('account', accountId);
    body.set('type', 'account_onboarding');
    body.set('return_url', returnUrl);
    body.set('refresh_url', refreshUrl);
    body.set('collection_options[fields]', 'currently_due');

    const response = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-10-28.acacia',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new InternalServerErrorException(
        `Stripe account link error: ${error.error?.message || 'Unknown error'}`,
      );
    }

    return response.json();
  }

  private async createLoginLink(accountId: string): Promise<any> {
    const response = await fetch(
      `https://api.stripe.com/v1/accounts/${accountId}/login_links`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Stripe-Version': '2024-10-28.acacia',
        },
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new InternalServerErrorException(
        `Stripe login link error: ${error.error?.message || 'Unknown error'}`,
      );
    }

    return response.json();
  }

  private async retrieveStripeAccount(accountId: string): Promise<any> {
    const response = await fetch(
      `https://api.stripe.com/v1/accounts/${accountId}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Stripe-Version': '2024-10-28.acacia',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Stripe API error: ${response.status}`);
    }

    return response.json();
  }
}
