import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { CheckrService } from './checkr.service';
import { createHmac, timingSafeEqual } from 'crypto';

@ApiTags('webhooks')
@Controller('webhooks')
export class CheckrWebhookController {
  private readonly logger = new Logger(CheckrWebhookController.name);
  private readonly webhookSecret: string;

  constructor(private readonly checkrService: CheckrService) {
    this.webhookSecret =
      process.env.CHECKR_WEBHOOK_SECRET ||
      process.env.CHECKR_API_KEY ||
      '';
  }

  @Post('checkr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Checkr background check webhooks' })
  @ApiHeader({
    name: 'X-Checkr-Signature',
    description: 'HMAC-SHA256 signature from Checkr',
    required: true,
  })
  async handleWebhook(
    @Body() body: Record<string, any>,
    @Headers('x-checkr-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing X-Checkr-Signature header');
    }

    this.verifySignature(body, signature);

    const { type, data } = body;

    this.logger.log(`Received Checkr webhook: ${type} (report: ${data.id})`);

    switch (type) {
      case 'report.completed':
        await this.checkrService.handleWebhookReportCompleted(
          data.id,
          data.candidate_id,
          data.status,
          data.adjudication,
        );
        break;

      case 'report.continual':
        this.logger.log(
          `Continual monitoring update for report ${data.id}: ${data.status}`,
        );
        break;

      case 'candidate.completed':
        this.logger.log(
          `Candidate ${data.id} completed all reports`,
        );
        break;

      case 'invitation.completed':
        this.logger.log(
          `Invitation completed for candidate ${data.candidate_id}`,
        );
        break;

      default:
        this.logger.log(`Unhandled Checkr webhook type: ${type}`);
    }

    return { received: true };
  }

  private verifySignature(
    body: Record<string, any>,
    signature: string,
  ): void {
    if (!this.webhookSecret) {
      this.logger.warn(
        'CHECKR_WEBHOOK_SECRET not configured, skipping signature verification',
      );
      return;
    }

    const rawBody = JSON.stringify(body);
    const expectedSig = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      this.logger.error('Checkr webhook signature verification failed');
      throw new BadRequestException('Invalid webhook signature');
    }
  }
}
