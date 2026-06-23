import { Controller, Get, Post, UseFilters, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileSubscriptionsService } from '../services/mobile-subscriptions.service';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/subscriptions')
@UseGuards(MobileAuthGuard)
export class MobileSubscriptionsController {
  constructor(private readonly subscriptions: MobileSubscriptionsService) {}

  @Get('config')
  config() {
    return this.subscriptions.getConfig();
  }

  @Get('me')
  me(@MobileAuthUser() user: MobileUser) {
    return this.subscriptions.me(user);
  }

  @Post('start')
  start(@MobileAuthUser() user: MobileUser) {
    return this.subscriptions.start(user);
  }
}
