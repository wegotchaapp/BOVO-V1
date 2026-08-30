import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TripRepliesService } from './trip-replies.service';

@ApiTags('trip-replies')
@Controller()
export class TripRepliesController {
  constructor(private readonly tripRepliesService: TripRepliesService) {}

  @Post('trips/:tripId/replies')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Create a reply to a trip' })
  async createReply(
    @Request() req: any,
    @Param('tripId') tripId: string,
    @Body('text') text: string,
  ) {
    return this.tripRepliesService.createReply(tripId, req.user.sub, text);
  }

  @Get('trips/:tripId/replies')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get replies for a trip' })
  async getReplies(@Param('tripId') tripId: string) {
    return this.tripRepliesService.getReplies(tripId);
  }

  @Post('trip-replies/:replyId/read')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Mark a trip reply as read' })
  async markRead(@Request() req: any, @Param('replyId') replyId: string) {
    await this.tripRepliesService.markRead(replyId, req.user.sub);
    return { message: 'Reply marked as read' };
  }
}
