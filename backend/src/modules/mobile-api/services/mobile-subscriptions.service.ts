import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { MobileUser } from '../entities/mobile.entities';

const FOUNDING_MEMBER_TRIAL_DAYS = 365;
const RESUMABLE_STATUSES = new Set(['incomplete', 'incomplete_expired']);

@Injectable()
export class MobileSubscriptionsService {
  constructor(
    @InjectRepository(MobileUser)
    private readonly users: Repository<MobileUser>,
    private readonly config: ConfigService,
  ) {}

  private stripe(): Stripe {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key || key.includes('mock')) {
      throw new InternalServerErrorException('Payments are not configured');
    }
    return new Stripe(key);
  }

  private publishableKey(): string {
    const key = this.config.get<string>('STRIPE_PUBLISHABLE_KEY');
    if (!key) {
      throw new InternalServerErrorException('Payments are not configured');
    }
    return key;
  }

  getConfig() {
    return { publishableKey: this.publishableKey() };
  }

  me(user: MobileUser) {
    return {
      hasSubscription: Boolean(user.stripe_subscription_id),
      ...(user.subscription_status ? { status: user.subscription_status } : {}),
      ...(user.trial_ends_at
        ? { trialEndsAt: user.trial_ends_at.toISOString() }
        : {}),
      cancelAtPeriodEnd: false,
    };
  }

  async start(user: MobileUser) {
    const stripe = this.stripe();
    const publishableKey = this.publishableKey();
    const priceId = this.config.get<string>('STRIPE_PRICE_ID');
    if (!priceId) {
      throw new InternalServerErrorException(
        'Bovogo Premium price not configured (set STRIPE_PRICE_ID).',
      );
    }

    if (user.stripe_subscription_id) {
      const existing = await stripe.subscriptions.retrieve(
        user.stripe_subscription_id,
        { expand: ['latest_invoice.payment_intent', 'pending_setup_intent'] },
      );
      if (RESUMABLE_STATUSES.has(existing.status)) {
        return this.toStartResponse(existing, publishableKey);
      }
      throw new ConflictException('Subscription already exists for this user');
    }

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { bovogoUserId: user.id },
      });
      customerId = customer.id;
      user.stripe_customer_id = customerId;
      await this.users.save(user);
    }

    const trialDays = user.is_founding_member ? FOUNDING_MEMBER_TRIAL_DAYS : 0;
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: trialDays > 0 ? trialDays : undefined,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      metadata: {
        bovogoUserId: user.id,
        isFoundingMember: String(user.is_founding_member),
      },
    });

    user.stripe_subscription_id = subscription.id;
    user.subscription_status = subscription.status;
    user.trial_ends_at = subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : null;
    await this.users.save(user);

    return this.toStartResponse(subscription, publishableKey);
  }

  private toStartResponse(
    subscription: Stripe.Subscription,
    publishableKey: string,
  ) {
    const trialEndsAt = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null;
    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret: this.extractClientSecret(subscription),
      publishableKey,
      ...(trialEndsAt ? { trialEndsAt } : {}),
    };
  }

  private extractClientSecret(
    subscription: Stripe.Subscription,
  ): string | null {
    const setupIntent = subscription.pending_setup_intent as
      | Stripe.SetupIntent
      | string
      | null
      | undefined;
    if (setupIntent && typeof setupIntent !== 'string') {
      return setupIntent.client_secret ?? null;
    }
    const invoice = subscription.latest_invoice as
      | Stripe.Invoice
      | string
      | null
      | undefined;
    if (invoice && typeof invoice !== 'string') {
      const pi = (
        invoice as unknown as {
          payment_intent?: Stripe.PaymentIntent | string | null;
        }
      ).payment_intent;
      if (pi && typeof pi !== 'string') {
        return pi.client_secret ?? null;
      }
    }
    return null;
  }
}
