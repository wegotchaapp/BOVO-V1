import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UseFilters } from '@nestjs/common';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileTripsService } from '../services/mobile-trips.service';
import { CreateReplyBody, CreateTripBody } from '../dto/mobile.dto';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/trips')
@UseGuards(MobileAuthGuard)
export class MobileTripsController {
  constructor(private readonly trips: MobileTripsService) {}

  @Get()
  list(@Query('from') from?: string, @Query('to') to?: string) {
    return this.trips.list(from, to);
  }

  @Get('mine')
  mine(@MobileAuthUser() user: MobileUser) {
    return this.trips.mine(user.id);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.trips.getOne(id);
  }

  @Post()
  create(@MobileAuthUser() user: MobileUser, @Body() dto: CreateTripBody) {
    return this.trips.create(user.id, dto);
  }

  @Delete(':id')
  cancel(@MobileAuthUser() user: MobileUser, @Param('id') id: string) {
    return this.trips.cancel(user.id, id);
  }

  @Post(':id/replies')
  reply(
    @MobileAuthUser() user: MobileUser,
    @Param('id') id: string,
    @Body() dto: CreateReplyBody,
  ) {
    return this.trips.reply(user.id, id, dto);
  }

  @Post(':id/mark-read')
  @HttpCode(HttpStatus.OK)
  markRead(@MobileAuthUser() user: MobileUser, @Param('id') id: string) {
    return this.trips.markRead(user.id, id);
  }
}
