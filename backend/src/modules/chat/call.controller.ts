import { Controller, Post, Get, Body, Param, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MaskedCallService } from './call.service';

@ApiTags('chat')
@Controller('chat/calls')
export class MaskedCallController {
  constructor(private readonly maskedCallService: MaskedCallService) {}

  @Post('initiate/:bookingId')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Initiate a masked call between driver and rider' })
  async initiateCall(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
  ) {
    return this.maskedCallService.initiateCall(req.user.id, bookingId);
  }

  @Post('webhook/:bookingId')
  @ApiOperation({ summary: 'Twilio call status webhook' })
  async callWebhook(
    @Param('bookingId') bookingId: string,
    @Body() payload: any,
  ) {
    await this.maskedCallService.handleCallWebhook(bookingId, payload);
    return { received: true };
  }
}
