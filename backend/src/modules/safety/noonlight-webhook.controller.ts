import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { PinoLogger } from 'nestjs-pino';
import * as crypto from 'crypto';

import { SafetyService } from './safety.service';

/**
 * Header Noonlight signs the payload with.
 *
 * NOTE: unconfirmed against Noonlight's docs — override with
 * `NOONLIGHT_WEBHOOK_SIGNATURE_HEADER` if it differs. Verification failures log
 * the header names received (never the values) so the right one is easy to spot
 * during sandbox testing.
 */
const DEFAULT_SIGNATURE_HEADER = 'x-noonlight-signature';

@ApiTags('safety')
@Controller('safety/noonlight')
export class NoonlightWebhookController {
  private readonly secret: string;
  private readonly signatureHeader: string;
  private readonly isProduction: boolean;

  constructor(
    private readonly safetyService: SafetyService,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.secret = this.config.get<string>('NOONLIGHT_WEBHOOK_SECRET') || '';
    this.signatureHeader = (
      this.config.get<string>('NOONLIGHT_WEBHOOK_SIGNATURE_HEADER') ||
      DEFAULT_SIGNATURE_HEADER
    ).toLowerCase();
    this.isProduction = this.config.get<string>('NODE_ENV') === 'production';
  }

  /**
   * Receives Noonlight alarm status updates and moves the matching SOS event.
   *
   * This endpoint mutates the state of a live emergency, so it is unauthenticated
   * by necessity and fails closed: without a configured secret it serves only
   * outside production, which is what makes sandbox bring-up possible before
   * Noonlight has generated one (it only does so once a URL is saved).
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handle(@Req() req: any, @Headers() headers: Record<string, string>) {
    const raw: Buffer | undefined = req.rawBody;

    if (!this.secret) {
      if (this.isProduction) {
        this.logger.error(
          'Noonlight webhook rejected: NOONLIGHT_WEBHOOK_SECRET is not set in production.',
        );
        throw new UnauthorizedException('Webhook secret not configured');
      }
      this.logger.warn(
        'Noonlight webhook accepted WITHOUT signature verification — no NOONLIGHT_WEBHOOK_SECRET set. Non-production only.',
      );
    } else {
      this.verify(raw, headers);
    }

    const payload = req.body;
    this.logger.info({ payload }, 'Noonlight webhook received');

    // Noonlight posts an array of events. A single object is accepted too, so
    // that a future change of theirs degrades to "handled" rather than "dropped".
    const events: any[] = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object'
        ? [payload]
        : [];

    if (events.length === 0) {
      this.logger.warn('Noonlight webhook body held no events — ignoring');
      return { received: true, applied: 0, events: 0 };
    }

    let applied = 0;
    for (const event of events) {
      const result = await this.safetyService.handleNoonlightEvent(event);
      if (result.applied) applied += 1;
    }

    return { received: true, events: events.length, applied };
  }

  /** HMAC-SHA256 over the exact bytes received, hex or base64. */
  private verify(
    raw: Buffer | undefined,
    headers: Record<string, string>,
  ): void {
    if (!raw || !Buffer.isBuffer(raw)) {
      // Without the raw bytes any signature check is meaningless, so refuse
      // rather than wave the request through.
      this.logger.error(
        'Noonlight webhook rejected: raw body unavailable. Check that the rawBody middleware for this path is registered before the global express.json in main.ts.',
      );
      throw new UnauthorizedException('Invalid signature');
    }

    const provided = headers[this.signatureHeader];
    if (!provided) {
      this.logger.error(
        {
          expectedHeader: this.signatureHeader,
          received: Object.keys(headers),
        },
        'Noonlight webhook rejected: signature header absent',
      );
      throw new UnauthorizedException('Invalid signature');
    }

    const digest = crypto
      .createHmac('sha256', this.secret)
      .update(raw)
      .digest();
    const candidates = [digest.toString('hex'), digest.toString('base64')];

    const ok = candidates.some((expected) => {
      const a = Buffer.from(expected);
      const b = Buffer.from(provided);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    });

    if (!ok) {
      this.logger.error(
        { header: this.signatureHeader },
        'Noonlight webhook rejected: signature mismatch',
      );
      throw new UnauthorizedException('Invalid signature');
    }
  }
}
