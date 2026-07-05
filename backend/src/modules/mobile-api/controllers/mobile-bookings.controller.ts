import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UseFilters } from '@nestjs/common';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileBookingsService } from '../services/mobile-bookings.service';
import {
  ConfirmBookingBody,
  CreateBookingBody,
  LiveLocationBody,
} from '../dto/mobile.dto';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/bookings')
@UseGuards(MobileAuthGuard)
export class MobileBookingsController {
  constructor(private readonly bookings: MobileBookingsService) {}

  @Post()
  create(@MobileAuthUser() user: MobileUser, @Body() dto: CreateBookingBody) {
    return this.bookings.create(user.id, dto);
  }

  @Post('prepare')
  prepare(@MobileAuthUser() user: MobileUser, @Body() dto: CreateBookingBody) {
    return this.bookings.prepare(user.id, dto);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @MobileAuthUser() user: MobileUser,
    @Body() dto: ConfirmBookingBody,
  ) {
    return this.bookings.confirm(user.id, dto.bookingId);
  }

  @Get('mine')
  mine(@MobileAuthUser() user: MobileUser) {
    return this.bookings.mine(user.id);
  }

  @Get(':id/tracking')
  tracking(@MobileAuthUser() user: MobileUser, @Param('id') id: string) {
    return this.bookings.getTracking(user.id, id);
  }

  @Post(':id/location')
  @HttpCode(HttpStatus.OK)
  postLocation(
    @MobileAuthUser() user: MobileUser,
    @Param('id') id: string,
    @Body() dto: LiveLocationBody,
  ) {
    return this.bookings.postLocation(user.id, id, dto);
  }

  @Get(':id')
  getOne(@MobileAuthUser() user: MobileUser, @Param('id') id: string) {
    return this.bookings.getOne(user.id, id);
  }
}
