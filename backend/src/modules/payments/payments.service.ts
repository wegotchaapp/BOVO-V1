import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PinoLogger } from 'nestjs-pino';
import {
  Payment,
  Payout,
  Refund,
  InsurancePolicy,
} from '../../database/entities/payment.entities';
import { Booking } from '../../database/entities/booking.entities';
import { User } from '../../database/entities/user.entity';
import { PRICING } from '../pricing/pricing.config';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    @InjectRepository(Refund)
    private readonly refundRepo: Repository<Refund>,
    @InjectRepository(InsurancePolicy)
    private readonly insuranceRepo: Repository<InsurancePolicy>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  async createPaymentIntent(
    amountCents: number,
    metadata: Record<string, string>,
  ): Promise<{ client_secret: string; payment_intent_id: string }> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      capture_method: 'manual',
      metadata,
    });

    return {
      client_secret: paymentIntent.client_secret!,
      payment_intent_id: paymentIntent.id,
    };
  }

  async capturePayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.capture(paymentIntentId);
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    await this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  async refundPayment(
    paymentIntentId: string,
    amountCents: number,
    reason: string,
  ): Promise<{ refund_id: string }> {
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountCents,
      reason: 'requested_by_customer',
      metadata: { reason },
    });

    return { refund_id: refund.id };
  }

  async recordPayment(
    bookingId: string,
    paymentIntentId: string,
    amountCents: number,
    status: string,
  ): Promise<Payment> {
    const payment = this.paymentRepo.create({
      booking_id: bookingId,
      stripe_payment_intent_id: paymentIntentId,
      amount: amountCents / 100,
      currency: 'usd',
      status,
    });
    return this.paymentRepo.save(payment);
  }

  async getPaymentByBooking(bookingId: string): Promise<Payment | null> {
    return this.paymentRepo.findOne({
      where: { booking_id: bookingId },
      order: { created_at: 'DESC' },
    });
  }

  async recordRefund(
    paymentId: string,
    amountCents: number,
    reason: string,
    stripeRefundId: string,
  ): Promise<Refund> {
    const refund = this.refundRepo.create({
      payment_id: paymentId,
      amount: amountCents / 100,
      reason,
      stripe_refund_id: stripeRefundId,
      status: 'processing',
    });
    return this.refundRepo.save(refund);
  }

  async schedulePayout(
    driverId: string,
    bookingId: string,
    amountCents: number,
    scheduledFor: Date,
  ): Promise<Payout> {
    const driver = await this.userRepo.findOne({ where: { id: driverId } });
    if (!driver?.stripe_account_id) {
      throw new BadRequestException('Driver has no connected Stripe account');
    }

    const IRS_THRESHOLD = 600;
    const currentYtd = Number(driver.ytd_earnings || 0);
    const payoutAmount = amountCents / 100;
    const projectedYtd = currentYtd + payoutAmount;

    if (projectedYtd >= IRS_THRESHOLD && !driver.w9_on_file) {
      driver.tax_blocked = true;
      await this.userRepo.save(driver);
      throw new BadRequestException(
        `IRS 1099-K requirement: Your year-to-date earnings ($${projectedYtd.toFixed(2)}) exceed the $${IRS_THRESHOLD} threshold. Please submit Form W-9 before payouts can continue.`,
      );
    }

    if (projectedYtd >= IRS_THRESHOLD && !driver.tax_notification_5k_sent) {
      this.logger.warn(
        { driverId, ytd: projectedYtd },
        'Driver approaching 1099-K threshold — tax notification required',
      );
    }

    const payout = this.payoutRepo.create({
      driver_id: driverId,
      stripe_transfer_id: '',
      amount: amountCents / 100,
      currency: 'usd',
      status: 'scheduled',
      dispatched_at: null,
    });

    const saved = await this.payoutRepo.save(payout);

    this.logger.info(
      {
        payoutId: saved.id,
        driverId,
        amount: amountCents,
        scheduledFor,
        ytd_projected: projectedYtd,
      },
      'Payout scheduled for 24h after trip completion',
    );

    return saved;
  }

  async executePayout(payoutId: string): Promise<void> {
    const payout = await this.payoutRepo.findOne({ where: { id: payoutId } });
    if (!payout) throw new BadRequestException('Payout not found');

    const driver = await this.userRepo.findOne({
      where: { id: payout.driver_id },
    });
    if (!driver?.stripe_account_id) {
      throw new BadRequestException('Driver has no connected Stripe account');
    }

    if (driver.tax_blocked) {
      throw new BadRequestException(
        'Payouts blocked: Tax documentation (W-9) required. Contact support to resolve.',
      );
    }

    const transfer = await this.stripe.transfers.create({
      amount: Math.round(payout.amount * 100),
      currency: 'usd',
      destination: driver.stripe_account_id,
      metadata: { payout_id: payoutId },
    });

    payout.stripe_transfer_id = transfer.id;
    payout.status = 'dispatched';
    payout.dispatched_at = new Date().toISOString();
    await this.payoutRepo.save(payout);

    driver.ytd_earnings = Number(driver.ytd_earnings || 0) + payout.amount;
    driver.lifetime_earnings =
      Number(driver.lifetime_earnings || 0) + payout.amount;
    driver.last_payout_at = new Date().toISOString();
    await this.userRepo.save(driver);

    this.logger.info({ payoutId, transferId: transfer.id }, 'Payout executed');
  }

  async activateInsurancePolicy(bookingId: string): Promise<InsurancePolicy> {
    let policy = await this.insuranceRepo.findOne({
      where: { booking_id: bookingId },
    });

    if (!policy) {
      policy = this.insuranceRepo.create({
        booking_id: bookingId,
        is_active: false,
      });
    }

    policy.is_active = true;
    policy.activated_at = new Date().toISOString();
    policy.expires_at = new Date(Date.now() + 86400000).toISOString();
    policy.policy_number = `WG-INS-${Date.now()}`;
    policy.mga_reference = `MGA-${Math.random().toString(36).slice(2, 10)}`;

    await this.insuranceRepo.save(policy);

    this.logger.info(
      { bookingId, policyNumber: policy.policy_number },
      'Insurance policy activated',
    );

    return policy;
  }

  async remitToMGA(
    bookingId: string,
    premiumCents: number,
    source: 'trip_insurance' | 'luggage_insurance' = 'trip_insurance',
  ): Promise<{ mga_reference: string; remitted_cents: number }> {
    let mgaReference: string;
    let netPremiumCents: number;

    if (source === 'trip_insurance') {
      const policy = await this.insuranceRepo.findOne({
        where: { booking_id: bookingId },
      });
      if (!policy)
        throw new BadRequestException(
          'No insurance policy found for this booking',
        );

      const commission = Math.round(
        premiumCents * PRICING.INSURANCE_COMMISSION,
      );
      netPremiumCents = premiumCents - commission;

      policy.mga_remitted_cents = netPremiumCents;
      policy.mga_remitted_at = new Date().toISOString();
      if (!policy.mga_reference) {
        policy.mga_reference = `MGA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }
      mgaReference = policy.mga_reference;
      await this.insuranceRepo.save(policy);
    } else {
      const platformCommission = Math.round(
        premiumCents * PRICING.LUGGAGE_INSURANCE_COMMISSION,
      );
      netPremiumCents = premiumCents - platformCommission;
      mgaReference = `MGA-LI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    this.logger.info(
      { bookingId, source, premiumCents, netPremiumCents, mgaReference },
      `MGA remittance recorded — API call to MGA partner required`,
    );

    return { mga_reference: mgaReference, remitted_cents: netPremiumCents };
  }

  async onboardDriver(userId: string): Promise<{ account_link_url: string }> {
    const account = await this.stripe.accounts.create({
      type: 'express',
      country: 'US',
      metadata: { user_id: userId },
    });

    await this.userRepo.update(userId, {
      stripe_account_id: account.id,
      stripe_details_submitted: false,
    });

    const link = await this.stripe.accountLinks.create({
      account: account.id,
      return_url: `${this.config.get('APP_URL')}/payouts/return`,
      refresh_url: `${this.config.get('APP_URL')}/payouts/refresh`,
      type: 'account_onboarding',
    });

    return { account_link_url: link.url };
  }

  async getConnectStatus(userId: string, accountId: string) {
    const account = await this.stripe.accounts.retrieve(accountId);
    return {
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements: account.requirements,
    };
  }

  async refreshAccountLink(
    userId: string,
    accountId: string,
  ): Promise<{ account_link_url: string }> {
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      return_url: `${this.config.get('APP_URL')}/payouts/return`,
      refresh_url: `${this.config.get('APP_URL')}/payouts/refresh`,
      type: 'account_onboarding',
    });
    return { account_link_url: link.url };
  }

  async getDashboardLink(accountId: string): Promise<{ url: string }> {
    const loginLink = await this.stripe.accounts.createLoginLink(accountId);
    return { url: loginLink.url };
  }

  async handleWebhookPaymentIntentSucceeded(event: any): Promise<void> {
    const paymentIntent = event.data.object;
    this.logger.info(
      { paymentIntentId: paymentIntent.id },
      'PaymentIntent succeeded',
    );
  }

  async handleWebhookTransferCreated(event: any): Promise<void> {
    const transfer = event.data.object;
    this.logger.info({ transferId: transfer.id }, 'Transfer created');
  }

  async handleWebhook(event: any): Promise<void> {
    this.logger.info({ event: event.type }, 'Stripe webhook received');

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handleWebhookPaymentIntentSucceeded(event);
        break;
      case 'transfer.created':
        await this.handleWebhookTransferCreated(event);
        break;
      case 'transfer.paid':
        this.logger.info(
          `Transfer ${event.data.object.id} paid to connected account`,
        );
        break;
      case 'payout.created':
        this.logger.info(`Payout ${event.data.object.id} created`);
        break;
      case 'payout.paid':
        this.logger.info(
          `Payout ${event.data.object.id} paid to driver's bank`,
        );
        break;
      default:
        this.logger.info(`Unhandled Stripe webhook type: ${event.type}`);
    }
  }

  async getMyPayouts(userId: string): Promise<Payout[]> {
    return this.payoutRepo.find({
      where: { driver_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async getMyEarnings(userId: string): Promise<any> {
    const payouts = await this.payoutRepo.find({
      where: { driver_id: userId },
    });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return {
      this_week: payouts
        .filter(
          (p) => new Date(p.created_at) > weekAgo && p.status === 'dispatched',
        )
        .reduce((sum, p) => sum + p.amount, 0),
      this_month: payouts
        .filter(
          (p) => new Date(p.created_at) > monthAgo && p.status === 'dispatched',
        )
        .reduce((sum, p) => sum + p.amount, 0),
      ytd: payouts
        .filter(
          (p) =>
            new Date(p.created_at) > yearStart && p.status === 'dispatched',
        )
        .reduce((sum, p) => sum + p.amount, 0),
      pending: payouts
        .filter((p) => p.status === 'scheduled')
        .reduce((sum, p) => sum + p.amount, 0),
    };
  }
}
