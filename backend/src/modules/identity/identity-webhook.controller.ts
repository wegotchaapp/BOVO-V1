import { Controller, Post, Body, Headers, HttpCode, HttpStatus, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { IdentityService } from './identity.service';
import { PinoLogger } from 'nestjs-pino';
import Stripe from 'stripe';

@ApiTags('identity')
@Controller('identity')
export class IdentityWebhookController {
  private readonly stripe: Stripe;

  constructor(
    private readonly identityService: IdentityService,
    private readonly logger: PinoLogger,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = (req as any).rawBody || (req as any).body;
    const webhookSecret = this.identityService.getWebhookSecret();

    let event: Stripe.Event;

    try {
      if (typeof rawBody === 'string') {
        event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } else if (Buffer.isBuffer(rawBody)) {
        event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } else {
        throw new Error('Unable to extract raw body');
      }
    } catch (err: unknown) {
      this.logger.error({ err }, 'Stripe webhook signature verification failed');
      return { error: 'Invalid signature' };
    }

    if (event.type.startsWith('identity.verification_session.')) {
      await this.identityService.handleVerificationWebhook(event);
    }

    return { received: true };
  }
}
