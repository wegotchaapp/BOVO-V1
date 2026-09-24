import {
  Controller,
  Post,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeConnectService } from './stripe-connect.service';
import {
  createStripeWebhookClient,
  verifyStripeWebhook,
} from '../../common/http/stripe-webhook.verifier';

@ApiTags('webhooks')
@Controller('webhooks')
export class StripeConnectWebhookController {
  private readonly logger = new Logger(StripeConnectWebhookController.name);
  private readonly webhookSecret: string;
  private readonly stripe: Stripe;

  constructor(
    private readonly stripeConnectService: StripeConnectService,
    private readonly config: ConfigService,
  ) {
    this.webhookSecret =
      this.config.get<string>('STRIPE_CONNECT_WEBHOOK_SECRET') ||
      '';
    this.stripe = createStripeWebhookClient(
      this.config.get<string>('STRIPE_SECRET_KEY'),
    );
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
    @Req() req: { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    // Was a hand-rolled HMAC over `JSON.stringify(req.body)`, which verifies a
    // re-serialisation rather than what Stripe signed, and was skipped
    // entirely when no secret was set. Both are gone: the SDK checks the raw
    // bytes, and an unconfigured secret rejects.
    const event = verifyStripeWebhook({
      stripe: this.stripe,
      rawBody: req.rawBody,
      signature,
      secret: this.webhookSecret,
      source: 'Stripe Connect',
      secretVar: 'STRIPE_CONNECT_WEBHOOK_SECRET',
    });

    // Widened to `string`: the switch below still handles `transfer.paid`,
    // which Stripe has since dropped from its typed event union.
    const type: string = event.type;
    const account = event.data.object as any;

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
}
