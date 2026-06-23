import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Ip,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto, SubmitRatingDto, BlockUserDto } from './chat.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List all conversations for current user' })
  async getConversations(@Request() req: any) {
    return this.chatService.getConversations(req.user.id);
  }

  @Get('conversations/:bookingId/messages')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get paginated message history for a booking' })
  async getMessages(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getMessages(
      req.user.id,
      bookingId,
      cursor,
      parseInt(String(limit)) || 50,
    );
  }

  @Post('conversations/:bookingId/messages')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Send a message in a booking conversation' })
  async sendMessage(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(req.user.id, bookingId, dto);
  }

  @Post('conversations/:bookingId/read')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Mark messages as read in a conversation (by booking ID)' })
  async markAsRead(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
  ) {
    await this.chatService.markMessagesAsRead(req.user.id, bookingId);
    return { success: true };
  }

  @Patch('conversations/:id/read')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Mark conversation as read by conversation ID' })
  async markConversationRead(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    await this.chatService.markConversationRead(req.user.id, id);
    return { success: true };
  }

  @Get('dms')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List direct messages for current user' })
  async getDms(@Request() req: any) {
    return this.chatService.getDms(req.user.id);
  }

  @Post('support/initiate')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create or return existing support thread' })
  async initiateSupport(@Request() req: any) {
    return this.chatService.initiateSupport(req.user.id);
  }

  @Get('dm/:id/messages')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get paginated messages for a DM conversation' })
  async getDmMessages(
    @Request() req: any,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getDmMessages(
      req.user.id,
      id,
      cursor,
      parseInt(String(limit)) || 50,
    );
  }

  @Post('dm/:id/messages')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Send a message in a DM conversation' })
  async sendDmMessage(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendDmMessage(req.user.id, id, dto);
  }

  @Get('has-paid')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Check if user has a paid booking (gate for messages access)' })
  async hasPaid(@Request() req: any) {
    const hasPaid = await this.chatService.userHasPaidBookings(req.user.id);
    return { has_paid: hasPaid };
  }

  @Get('group/:bookingId')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get group conversation details with messages' })
  async getGroup(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    const hasPaid = await this.chatService.userHasPaidBookings(req.user.id);
    if (!hasPaid) throw new ForbiddenException('Payment required to access messages');
    return this.chatService.getGroup(req.user.id, bookingId, cursor, parseInt(String(limit)) || 50);
  }

  @Post('group/:bookingId/message')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Send a message in a group conversation' })
  async sendGroupMessage(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
    @Body() dto: SendMessageDto,
  ) {
    const hasPaid = await this.chatService.userHasPaidBookings(req.user.id);
    if (!hasPaid) throw new ForbiddenException('Payment required to access messages');
    return this.chatService.sendMessage(req.user.id, bookingId, dto);
  }

  @Delete('group/:bookingId')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete/archive a group conversation' })
  async deleteGroup(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
  ) {
    const hasPaid = await this.chatService.userHasPaidBookings(req.user.id);
    if (!hasPaid) throw new ForbiddenException('Payment required to access messages');
    await this.chatService.deleteGroup(req.user.id, bookingId);
    return { success: true };
  }

  @Post('conversations/:bookingId/block')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Block counterparty platform-wide' })
  async blockUser(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
    @Body() dto: BlockUserDto,
  ) {
    await this.chatService.blockUser(req.user.id, bookingId, dto.blocked_user_id);
    return { success: true, message: 'User blocked' };
  }

  @Post('calls/initiate/:bookingId')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Initiate a masked call between driver and rider' })
  async initiateCall(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
  ) {
    return this.chatService.initiateMaskedCall(req.user.id, bookingId);
  }

  @Post('calls/webhook/:bookingId')
  @ApiOperation({ summary: 'Twilio call status webhook' })
  async callWebhook(
    @Param('bookingId') bookingId: string,
    @Body() payload: any,
  ) {
    await this.chatService.handleCallWebhook(bookingId, payload);
    return { received: true };
  }

  @Get('calls/twiml/:bookingId')
  @ApiOperation({ summary: 'Twilio TwiML endpoint for call routing' })
  async getTwiml(@Param('bookingId') _bookingId: string) {
    return {
      twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Number>{{receiver_phone}}</Number>
  </Dial>
</Response>`,
    };
  }

  @Post('ratings/:bookingId')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Submit a rating after trip completion' })
  async submitRating(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
    @Body() dto: SubmitRatingDto,
  ) {
    return this.chatService.submitRating(req.user.id, bookingId, dto);
  }

  @Get('ratings/:bookingId/status')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get rating status for a booking' })
  async getRatingStatus(
    @Request() req: any,
    @Param('bookingId') bookingId: string,
  ) {
    return this.chatService.getRatingStatus(bookingId, req.user.id);
  }

  @Get('ratings/my-profile')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get my aggregate rating (only after 5+ ratings)' })
  async getMyProfileRating(@Request() req: any) {
    return this.chatService.getMyProfileRating(req.user.id);
  }
}
