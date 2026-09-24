import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { EmergencyContactsService } from '../auth/emergency-contacts.service';
import { TwilioSignatureGuard } from '../../common/guards/twilio-signature.guard';

@ApiTags('webhooks')
@Controller('webhooks')
@ApiHeader({
  name: 'X-Twilio-Signature',
  description: 'Twilio request signature',
  required: true,
})
// Anyone can POST here. Before this guard, a stranger could opt an arbitrary
// number out of emergency SMS by naming it in `From`.
@UseGuards(TwilioSignatureGuard)
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(private readonly service: EmergencyContactsService) {}

  @Post('twilio/opt-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Twilio SMS opt-out (STOP reply)' })
  async handleOptOut(@Body() body: Record<string, string>) {
    const { From, Body: text } = body;

    // The phone number and the message text are both subscriber content, and
    // this log line shipped them to whatever aggregates stdout. Only the
    // outcome is recorded.
    if (text && text.toUpperCase().trim() === 'STOP') {
      await this.service.handleOptOut(From);
      this.logger.log('Twilio opt-out processed for one contact');
      return { message: 'OK' };
    }

    this.logger.log('Twilio inbound message ignored (not an opt-out keyword)');
    return { message: 'OK' };
  }

  @Post('twilio/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Twilio delivery status callbacks' })
  async handleStatus(@Body() body: Record<string, string>) {
    const { MessageSid, MessageStatus } = body;
    // MessageSid is an opaque Twilio identifier; the destination number is not.
    this.logger.log(`SMS ${MessageSid} status: ${MessageStatus}`);
    return { message: 'OK' };
  }
}
