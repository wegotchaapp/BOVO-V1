import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TripGroupsService } from './trip-groups.service';

@ApiTags('trip-groups')
@Controller('trip-groups')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth('JWT')
export class TripGroupsController {
  constructor(private readonly tripGroupsService: TripGroupsService) {}

  @Get('by-trip/:tripId')
  @ApiOperation({ summary: 'Get trip group by trip ID' })
  async getGroupByTripId(@Param('tripId') tripId: string) {
    return this.tripGroupsService.getGroupByTripId(tripId);
  }

  @Post(':groupId/messages')
  @ApiOperation({ summary: 'Send a message to the trip group' })
  async sendMessage(
    @Param('groupId') groupId: string,
    @Body('sender_id') senderId: string | null,
    @Body('text') text: string,
    @Body('is_system') isSystem: boolean,
  ) {
    return this.tripGroupsService.sendMessage(groupId, senderId, text, isSystem);
  }

  @Get(':groupId/messages')
  @ApiOperation({ summary: 'Get messages for a trip group' })
  async getMessages(
    @Param('groupId') groupId: string,
    @Query('limit') limit?: number,
  ) {
    return this.tripGroupsService.getMessages(groupId, limit ? parseInt(String(limit), 10) : undefined);
  }

  @Post(':groupId/pickup-vote')
  @ApiOperation({ summary: 'Vote for a pickup hub' })
  async votePickupHub(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Body('hub_id') hubId: string,
  ) {
    return this.tripGroupsService.votePickupHub(groupId, req.user.id, hubId);
  }

  @Get(':groupId/pickup-status')
  @ApiOperation({ summary: 'Get pickup hub voting status' })
  async getPickupHubStatus(@Param('groupId') groupId: string) {
    return this.tripGroupsService.getPickupHubStatus(groupId);
  }
}
