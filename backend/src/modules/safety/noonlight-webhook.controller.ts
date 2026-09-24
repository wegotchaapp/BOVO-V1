import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  ServiceUnavailableException,
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
 * Noonlight documents webhook authenticity at
 * https://docs.noonlight.com/reference/webhook-authenticity — an HMAC-SHA256
 * over the exact request bytes, keyed by the webhook secret they issue once a
 * URL is saved. The header *name* has not been confirmed against a real
 * callback for this account, so it stays overridable with
 * `NOONLIGHT_WEBHOOK_SIGNATURE_HEADER`, and verification failures log the
 * header names received (never the values) so the right one is easy to spot
 * during sandbox bring-up. Both hex and base64 digests are accepted, since the
 * encoding is likewise unconfirmed for this account; confirm both at
 * provisioning and narrow this if the provider is stricter than assumed.
 */
const DEFAULT_SIGNATURE_HEADER = 'x-noonlight-signature';

@ApiTags('safety')
@Controller('safety/noonlight')
export class NoonlightWebhookController {
  private readonly secret: string;
  private readonly signatureHeader: string;

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
  }

  /**
   * Receives Noonlight alarm status updates and moves the matching SOS event.
   *
   * The endpoint mutates the state of a live emergency and carries no session,
   * so the signature is the only thing standing between an anonymous caller and
   * closing someone's alarm. It therefore fails closed in **every** environment:
   * there is no environment in which processing an unverified emergency update
   * is the behaviour we want, so a missing secret is never waved through.
   *
   * A missing secret and a bad signature are answered differently on purpose:
   *
   * - **No secret configured → 503.** This is our fault, not the caller's, and
   *   the update is still valid. A 5xx is the code Noonlight retries, so the
   *   event survives the misconfiguration instead of being acknowledged as
   *   handled when nothing handled it.
   * - **Signature absent or wrong → 401.** Nothing here should retry that.
   *
   * The cost is that sandbox bring-up now needs `NOONLIGHT_WEBHOOK_SECRET` set
   * before the endpoint will serve anything, including locally. Noonlight only
   * issues the secret once a webhook URL is saved, so the local value can be any
   * non-empty string until then — both ends simply have to agree.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handle(@Req() req: any, @Headers() headers: Record<string, string>) {
    const raw: Buffer | undefined = req.rawBody;

    if (!this.secret) {
      this.logger.error(
        'Noonlight webhook rejected: NOONLIGHT_WEBHOOK_SECRET is not set. The endpoint refuses to process unverified emergency updates in any environment; returning 503 so the provider retries once it is configured.',
      );
      throw new ServiceUnavailableException('Webhook secret not configured');
    }

    this.verify(raw, headers);

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
