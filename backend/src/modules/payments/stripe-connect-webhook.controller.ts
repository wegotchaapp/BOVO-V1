import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { StripeConnectService } from './stripe-connect.service';
import { createHmac, timingSafeEqual } from 'crypto';

@ApiTags('webhooks')
@Controller('webhooks')
export class StripeConnectWebhookController {
  private readonly logger = new Logger(StripeConnectWebhookController.name);
  private readonly webhookSecret: string;

  constructor(private readonly stripeConnectService: StripeConnectService) {
    this.webhookSecret =
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET ||
      '';
  }

  @Post('stripe-connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe Connect webhooks' })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Stripe webhook signature',
    required: true,
  })
  async handleWebhook(
    @Body() body: Record<string, any>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    if (this.webhookSecret) {
      this.verifySignature(JSON.stringify(body), signature);
    }

    const { type, data } = body;
    const account = data.object;

    this.logger.log(
      `Received Stripe webhook: ${type} (account: ${account.id || 'N/A'})`,
    );

    switch (type) {
      case 'account.updated':
        await this.stripeConnectService.handleWebhookAccountUpdated(
          account.id,
          account,
        );
        break;

      case 'account.application.authorized':
        this.logger.log(
          `Account ${account.id} authorized Bovogo platform access`,
        );
        break;

      case 'account.application.deauthorized':
        this.logger.log(
          `Account ${account.id} deauthorized Bovogo platform access`,
        );
        break;

      case 'payment_intent.succeeded':
        await this.stripeConnectService.handleWebhookPaymentIntentSucceeded(
          account,
        );
        break;

      case 'transfer.created':
        await this.stripeConnectService.handleWebhookTransferCreated(account);
        break;

      case 'transfer.paid':
        this.logger.log(`Transfer ${account.id} paid to connected account`);
        break;

      case 'payout.created':
        this.logger.log(`Payout ${account.id} created`);
        break;

      case 'payout.paid':
        this.logger.log(`Payout ${account.id} paid to driver's bank`);
        break;

      default:
        this.logger.log(`Unhandled Stripe webhook type: ${type}`);
    }

    return { received: true };
  }

  private verifySignature(rawBody: string, signature: string): void {
    if (!this.webhookSecret) return;

    const parts = signature.split(',');
    let timestamp = '';
    let signatureValue = '';

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 't') timestamp = value;
      if (key === 'v1') signatureValue = value;
    }

    if (!timestamp || !signatureValue) {
      throw new BadRequestException('Invalid Stripe signature format');
    }

    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
    if (parseInt(timestamp, 10) < fiveMinutesAgo) {
      throw new BadRequestException('Stripe webhook timestamp too old');
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSig = createHmac('sha256', this.webhookSecret)
      .update(signedPayload)
      .digest('hex');

    const signatureBuffer = Buffer.from(signatureValue);
    const expectedBuffer = Buffer.from(expectedSig);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      this.logger.error('Stripe webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }
  }
}
