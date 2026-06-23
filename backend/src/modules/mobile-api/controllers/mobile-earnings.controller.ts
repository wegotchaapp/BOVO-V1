import { Controller, Get, Query, UseFilters, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileEarningsService } from '../services/mobile-earnings.service';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/earnings')
@UseGuards(MobileAuthGuard)
export class MobileEarningsController {
  constructor(private readonly earnings: MobileEarningsService) {}

  @Get()
  summary(
    @MobileAuthUser() user: MobileUser,
    @Query('period') period = 'month',
  ) {
    return this.earnings.summary(user.id, period);
  }
}
