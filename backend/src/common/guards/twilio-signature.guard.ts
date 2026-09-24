import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateRequest } from 'twilio';

export const TWILIO_SIGNATURE_HEADER = 'x-twilio-signature';
export const TWILIO_WEBHOOK_BASE_URL_VAR = 'TWILIO_WEBHOOK_BASE_URL';

/**
 * Rebuilds the URL Twilio signed, from configuration only.
 *
 * Twilio's signature covers the full request URL, so verification needs to
 * know that URL exactly. Nobody can mint a signature without
 * `TWILIO_AUTH_TOKEN` — the risk in deriving the URL from `Host`,
 * `X-Forwarded-Host` or `X-Forwarded-Proto` is replay, not forgery. One auth
 * token is shared by every origin a Twilio account points at (staging, a
 * preview deploy, a dev tunnel), so a request genuinely signed for one of
 * those is replayable here: the caller resends the captured params and
 * signature with the header set to the origin it was signed for, and the
 * server obligingly rebuilds that URL and validates it. Pinning the origin to
 * configuration removes the half of the comparison the caller supplied.
 */
export function canonicalWebhookUrl(baseUrl: string, originalUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${originalUrl}`;
}

/**
 * Validates `X-Twilio-Signature` with Twilio's own helper.
 *
 * Fails closed in every direction: no auth token, no configured base URL, no
 * signature header, or a body Twilio could not have signed in this form all
 * reject before the handler runs. There is no environment in which the check
 * is skipped — tests inject an explicit token instead.
 */
@Injectable()
export class TwilioSignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return false;

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      originalUrl?: string;
      url?: string;
      body?: unknown;
    }>();

    const authToken = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const baseUrl = this.config.get<string>(TWILIO_WEBHOOK_BASE_URL_VAR);

    if (!authToken || !baseUrl) {
      throw new InternalServerErrorException(
        `Twilio webhook verification is not configured. Set TWILIO_AUTH_TOKEN and ${TWILIO_WEBHOOK_BASE_URL_VAR} (the public https origin Twilio posts to).`,
      );
    }

    const header = req.headers[TWILIO_SIGNATURE_HEADER];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature) {
      throw new UnauthorizedException('Missing X-Twilio-Signature header');
    }

    const contentType = String(req.headers['content-type'] ?? '');
    if (!contentType.includes('application/x-www-form-urlencoded')) {
      // Twilio signs JSON callbacks with a bodySHA256 query parameter instead.
      // Bovogo registers no JSON callbacks, so anything else is rejected rather
      // than verified against the wrong scheme.
      throw new BadRequestException(
        'Twilio webhooks must be form-encoded to be verifiable',
      );
    }

    const params = req.body;
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      throw new BadRequestException('Twilio webhook body is not verifiable');
    }

    const url = canonicalWebhookUrl(baseUrl, req.originalUrl ?? req.url ?? '');

    if (
      !validateRequest(
        authToken,
        signature,
        url,
        params as Record<string, string>,
      )
    ) {
      throw new UnauthorizedException('Invalid X-Twilio-Signature');
    }

    return true;
  }
}
