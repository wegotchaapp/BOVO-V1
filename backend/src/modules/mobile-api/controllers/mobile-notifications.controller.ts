import { Controller, Get, UseFilters, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileNotificationsService } from '../services/mobile-notifications.service';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/notifications')
@UseGuards(MobileAuthGuard)
export class MobileNotificationsController {
  constructor(private readonly notifications: MobileNotificationsService) {}

  @Get('unread')
  unread(@MobileAuthUser() user: MobileUser) {
    return this.notifications.unread(user.id);
  }
}
