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
      apiVersion: '2025-02-24.acacia',
    });
    this.webhookSecret =
      this.config.get<string>('STRIPE_WEBHOOK_SECRET') ||
      this.config.get<string>('STRIPE_CONNECT_WEBHOOK_SECRET') ||
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

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: 1500,
        currency: 'usd',
        metadata: { type: 'guild_subscription', user_id: req.user.id },
      });
      return {
        client_secret: paymentIntent.client_secret!,
        payment_intent_id: paymentIntent.id,
      };
    } catch {
      return { mock: true };
    }
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

    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY') || '';
    const isMock =
      secretKey.includes('mock') || secretKey.includes('test_local');

    if (isMock) {
      await this.userRepo.update(req.user.id, {
        subscription_tier: 'premium' as any,
        subscription_expires_at: new Date(
          Date.now() + 30 * 86400000,
        ).toISOString(),
      });
      return { activated: true };
    }

    if (!body.payment_intent_id) {
      throw new BadRequestException('payment_intent_id is required');
    }

    const paymentIntent = await this.stripe.paymentIntents.retrieve(
      body.payment_intent_id,
    );
    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException('Payment has not succeeded yet');
    }

    await this.userRepo.update(req.user.id, {
      subscription_tier: 'premium' as any,
      subscription_expires_at: new Date(
        Date.now() + 30 * 86400000,
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
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Start Stripe Connect Express onboarding' })
  async onboard(@Request() req: any) {
    return this.paymentsService.onboardDriver(req.user.sub);
  }

  @Get('connect/status')
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
    if (!sig) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: any;
    if (this.webhookSecret) {
      const rawBody = req.rawBody;
      if (!rawBody) {
        throw new BadRequestException(
          'Raw body not available for signature verification',
        );
      }
      try {
        event = this.stripe.webhooks.constructEvent(
          rawBody,
          sig,
          this.webhookSecret,
        );
      } catch {
        throw new BadRequestException('Invalid Stripe webhook signature');
      }
    } else {
      event = req.body;
    }

    await this.paymentsService.handleWebhook(event);
    return { received: true };
  }

  @Post('payouts/:id/execute')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Execute a scheduled payout (admin/scheduled job)' })
  async executePayout(@Param('id') id: string) {
    return this.paymentsService.executePayout(id);
  }

  @Get('my-payouts')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List my payouts' })
  async myPayouts(@Request() req: any) {
    return this.paymentsService.getMyPayouts(req.user.sub);
  }

  @Get('my-earnings')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get earnings summary' })
  async myEarnings(@Request() req: any) {
    return this.paymentsService.getMyEarnings(req.user.sub);
  }

  @Post('tax/w9-submit')
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
