import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EmergencyContactsService } from '../auth/emergency-contacts.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(private readonly service: EmergencyContactsService) {}

  @Post('twilio/opt-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Twilio SMS opt-out (STOP reply)' })
  async handleOptOut(@Body() body: Record<string, string>) {
    const { From, Body } = body;
    this.logger.log(`Received Twilio webhook from ${From}: ${Body}`);

    if (Body && Body.toUpperCase().trim() === 'STOP') {
      await this.service.handleOptOut(From);
    }

    return { message: 'OK' };
  }

  @Post('twilio/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Twilio delivery status callbacks' })
  async handleStatus(@Body() body: Record<string, string>) {
    const { MessageSid, MessageStatus, To } = body;
    this.logger.log(
      `SMS ${MessageSid} to ${To} status: ${MessageStatus}`,
    );
    return { message: 'OK' };
  }
}
