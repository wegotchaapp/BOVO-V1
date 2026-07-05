import { Body, Controller, Get, Post, UseFilters, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileVehiclesService } from '../services/mobile-vehicles.service';
import { UpsertVehicleBody } from '../dto/mobile.dto';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/vehicles')
@UseGuards(MobileAuthGuard)
export class MobileVehiclesController {
  constructor(private readonly vehicles: MobileVehiclesService) {}

  @Get('mine')
  mine(@MobileAuthUser() user: MobileUser) {
    return this.vehicles.mine(user.id);
  }

  @Post()
  upsert(@MobileAuthUser() user: MobileUser, @Body() dto: UpsertVehicleBody) {
    return this.vehicles.upsert(user.id, dto);
  }
}
