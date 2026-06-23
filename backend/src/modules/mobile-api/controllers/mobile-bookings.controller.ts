import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UseFilters } from '@nestjs/common';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileBookingsService } from '../services/mobile-bookings.service';
import { CreateBookingBody } from '../dto/mobile.dto';
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

  @Get('mine')
  mine(@MobileAuthUser() user: MobileUser) {
    return this.bookings.mine(user.id);
  }

  @Get(':id')
  getOne(@MobileAuthUser() user: MobileUser, @Param('id') id: string) {
    return this.bookings.getOne(user.id, id);
  }
}
