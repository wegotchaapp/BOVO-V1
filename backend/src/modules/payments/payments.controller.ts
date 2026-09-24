import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { User } from '../../database/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { AdminGuard } from '../admin/admin.guard';
import {
  STRIPE_WEBHOOK_API_VERSION,
  verifyStripeWebhook,
} from '../../common/http/stripe-webhook.verifier';

/**
 * The Travel+ charge the client is asked to complete. `confirmSubscription`
 * re-checks every one of these against the PaymentIntent it is handed, because
 * the client chooses which intent id to send.
 */
const GUILD_SUBSCRIPTION_AMOUNT_CENTS = 1500;
const GUILD_SUBSCRIPTION_CURRENCY = 'usd';
const GUILD_SUBSCRIPTION_TYPE = 'guild_subscription';
const GUILD_SUBSCRIPTION_DAYS = 30;
/** A PaymentIntent older than this is not evidence of a purchase made now. */
const PAYMENT_INTENT_MAX_AGE_SECONDS = 3600;

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(
    private readonly paymentsService: PaymentsService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
      apiVersion: STRIPE_WEBHOOK_API_VERSION,
    });
    this.webhookSecret =
      this.config.get<string>('STRIPE_WEBHOOK_SECRET') ||
      '';
  }

  @Get('config')
  @ApiOperation({
    summary: 'Get Stripe publishable key for client-side initialization',
  })
  getConfig() {
    return {
      publishableKey: this.config.get<string>('STRIPE_PUBLISHABLE_KEY') || '',
    };
  }

  @Post('subscription/create-payment-intent')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Create subscription PaymentIntent for Stripe PaymentSheet',
  })
  async createSubscriptionPaymentIntent(@Request() req: any) {
    const user = await this.userRepo.findOne({ where: { id: req.user.id } });
    if (user?.subscription_tier === 'premium') {
      return { client_secret: null, subscribed: true };
    }

    // A failure here used to be swallowed into `{ mock: true }`, which the
    // client read as "subscription flow unavailable, proceed" — the same
    // pretend-payment path that `confirmSubscription` then honoured. Let the
    // Stripe error surface instead.
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: GUILD_SUBSCRIPTION_AMOUNT_CENTS,
      currency: GUILD_SUBSCRIPTION_CURRENCY,
      metadata: { type: GUILD_SUBSCRIPTION_TYPE, user_id: req.user.id },
    });
    return {
      client_secret: paymentIntent.client_secret!,
      payment_intent_id: paymentIntent.id,
    };
  }

  @Post('subscription/confirm')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Confirm subscription payment and activate Guild' })
  async confirmSubscription(
    @Request() req: any,
    @Body() body: { payment_intent_id?: string },
  ) {
    const user = await this.userRepo.findOne({ where: { id: req.user.id } });
    if (user?.subscription_tier === 'premium') {
      return { activated: true };
    }

    // No mock-key shortcut. A key merely *named* `..._test_local` or `..._mock`
    // used to grant 30 days of premium to any authenticated caller with an
    // empty body, and the key name is an operational detail, not an
    // authorization decision.
    if (!body.payment_intent_id) {
      throw new BadRequestException('payment_intent_id is required');
    }

    const paymentIntent = await this.stripe.paymentIntents.retrieve(
      body.payment_intent_id,
    );

    // The caller supplies the intent id, so every property that makes it
    // evidence of *this user's* Travel+ purchase is re-checked here.
    if (paymentIntent.metadata?.type !== GUILD_SUBSCRIPTION_TYPE) {
      throw new BadRequestException(
        'Payment intent is not a Travel+ subscription charge',
      );
    }
    if (paymentIntent.metadata?.user_id !== req.user.id) {
      throw new ForbiddenException(
        'Payment intent belongs to a different account',
      );
    }
    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException('Payment has not succeeded yet');
    }
    if (paymentIntent.currency !== GUILD_SUBSCRIPTION_CURRENCY) {
      throw new BadRequestException('Payment currency does not match Travel+');
    }
    const paid = paymentIntent.amount_received ?? paymentIntent.amount;
    if (paid !== GUILD_SUBSCRIPTION_AMOUNT_CENTS) {
      throw new BadRequestException('Payment amount does not match Travel+');
    }
    const age = Math.floor(Date.now() / 1000) - (paymentIntent.created ?? 0);
    if (age > PAYMENT_INTENT_MAX_AGE_SECONDS) {
      throw new BadRequestException(
        'Payment intent is too old to activate a subscription',
      );
    }

    await this.userRepo.update(req.user.id, {
      subscription_tier: 'premium' as any,
      subscription_expires_at: new Date(
        Date.now() + GUILD_SUBSCRIPTION_DAYS * 86400000,
      ).toISOString(),
    });

    return { activated: true };
  }

  @Post('subscription/cancel')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Cancel Travel+ subscription' })
  async cancelSubscription(@Request() req: any) {
    await this.userRepo.update(req.user.id, {
      subscription_tier: 'free' as any,
      subscription_expires_at: null,
    });
    return { cancelled: true };
  }

  @Post('connect/onboard')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Start Stripe Connect Express onboarding' })
  async onboard(@Request() req: any) {
    return this.paymentsService.onboardDriver(req.user.sub);
  }

  @Get('connect/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Check Connect account status' })
  async status(@Request() req: any) {
    const user = await this.userRepo.findOne({ where: { id: req.user.sub } });
    if (!user?.stripe_account_id) {
      throw new BadRequestException('No connected Stripe account');
    }
    return this.paymentsService.getConnectStatus(
      req.user.sub,
      user.stripe_account_id,
    );
  }

  @Post('connect/refresh')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Refresh expired account link' })
  async refresh(@Request() req: any) {
    const user = await this.userRepo.findOne({ where: { id: req.user.sub } });
    if (!user?.stripe_account_id) {
      throw new BadRequestException('No connected Stripe account');
    }
    return this.paymentsService.refreshAccountLink(
      req.user.sub,
      user.stripe_account_id,
    );
  }

  @Get('connect/dashboard-link')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get Stripe Express Dashboard link' })
  async dashboard(@Request() req: any) {
    const user = await this.userRepo.findOne({ where: { id: req.user.sub } });
    if (!user?.stripe_account_id) {
      throw new BadRequestException('No connected Stripe account');
    }
    return this.paymentsService.getDashboardLink(user.stripe_account_id);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async webhook(@Req() req: any, @Headers('stripe-signature') sig: string) {
    const event = verifyStripeWebhook({
      stripe: this.stripe,
      rawBody: req.rawBody,
      signature: sig,
      secret: this.webhookSecret,
      source: 'Stripe',
      secretVar: 'STRIPE_WEBHOOK_SECRET',
    });

    await this.paymentsService.handleWebhook(event);
    return { received: true };
  }

  @Post('payouts/:id/execute')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Execute a scheduled payout (admin/scheduled job)' })
  async executePayout(@Param('id') id: string) {
    return this.paymentsService.executePayout(id);
  }

  @Get('my-payouts')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List my payouts' })
  async myPayouts(@Request() req: any) {
    return this.paymentsService.getMyPayouts(req.user.sub);
  }

  @Get('my-earnings')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get earnings summary' })
  async myEarnings(@Request() req: any) {
    return this.paymentsService.getMyEarnings(req.user.sub);
  }

  @Post('tax/w9-submit')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Submit W-9 tax form (unblocks payouts above $600 threshold)',
  })
  async submitW9(@Request() req: any) {
    const user = await this.userRepo.findOne({ where: { id: req.user.sub } });
    if (!user) throw new BadRequestException('User not found');

    user.w9_on_file = true;
    user.w9_submitted_at = new Date().toISOString();
    user.tax_blocked = false;
    await this.userRepo.save(user);

    return {
      message: 'W-9 submitted successfully. Payouts unblocked.',
      w9_on_file: true,
      tax_blocked: false,
    };
  }

  @Get('tax/1099k-status')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Check 1099-K threshold status' })
  async get1099kStatus(@Request() req: any) {
    const user = await this.userRepo.findOne({ where: { id: req.user.sub } });
    if (!user) throw new BadRequestException('User not found');

    const IRS_THRESHOLD = 600;
    const ytd = Number(user.ytd_earnings || 0);
    const projected = ytd + Number(user.ytd_gross_volume || 0);

    return {
      ytd_earnings: ytd,
      projected_ytd: projected,
      threshold: IRS_THRESHOLD,
      approaching_threshold: projected >= IRS_THRESHOLD * 0.8,
      exceeds_threshold: projected >= IRS_THRESHOLD,
      w9_on_file: user.w9_on_file,
      tax_blocked: user.tax_blocked,
      action_required: projected >= IRS_THRESHOLD && !user.w9_on_file,
    };
  }
}
