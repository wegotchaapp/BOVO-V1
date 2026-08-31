import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Request,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationsService } from './notifications.service';

class DeviceRegisterDto {
  @IsString()
  expo_push_token!: string;

  @IsString()
  @IsOptional()
  device_id?: string;

  @IsString()
  @IsOptional()
  platform?: string;

  @IsString()
  @IsOptional()
  timezone?: string;
}

class NotificationPreferenceUpdateDto {
  @IsObject()
  @ValidateNested()
  preferences!: Record<string, Record<string, boolean>>;
}

@ApiTags('notifications')
@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('devices/register')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Register device push token' })
  async registerDevice(@Request() req: any, @Body() body: DeviceRegisterDto) {
    return this.notificationsService.registerDevice(
      req.user.id,
      body.expo_push_token,
      body.device_id,
      body.platform,
      body.timezone,
    );
  }

  @Get('preferences')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get notification preferences' })
  async getPreferences(@Request() req: any) {
    return this.notificationsService.getPreferences(req.user.id);
  }

  @Patch('preferences')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updatePreferences(
    @Request() req: any,
    @Body() body: NotificationPreferenceUpdateDto,
  ) {
    const updated = await this.notificationsService.updatePreferences(
      req.user.id,
      body.preferences,
    );
    return { message: 'Preferences updated', preferences: updated };
  }

  @Get('my')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get my notifications' })
  async getMyNotifications(
    @Request() req: any,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.notificationsService.getMyNotifications(
      req.user.id,
      limit || 50,
      cursor,
    );
  }

  @Get('unread-count')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@Request() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { unread_count: count };
  }

  @Patch(':id/read')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    await this.notificationsService.markAsRead(id, req.user.id);
    return { message: 'Marked as read' };
  }

  @Post('mark-all-read')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Request() req: any) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return { message: 'All marked as read' };
  }
}
