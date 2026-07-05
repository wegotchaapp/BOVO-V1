import {
  Body,
  Controller,
  Get,
  Put,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileAuthService } from '../services/mobile-auth.service';
import { UpsertPreferencesBody } from '../dto/mobile.dto';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';
import { userToDto } from '../mobile.mappers';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/preferences')
@UseGuards(MobileAuthGuard)
export class MobilePreferencesController {
  constructor(private readonly auth: MobileAuthService) {}

  @Get('me')
  me(@MobileAuthUser() user: MobileUser) {
    const dto = userToDto(user);
    return {
      preferences: dto.ridePreferences,
      preferencesCount: dto.preferencesCount,
    };
  }

  @Put('me')
  async upsert(
    @MobileAuthUser() user: MobileUser,
    @Body() dto: UpsertPreferencesBody,
  ) {
    const updated = await this.auth.patchMe(user, {
      ridePreferences: dto.preferences ?? {},
    });
    return {
      preferences: updated.ridePreferences,
      preferencesCount: updated.preferencesCount,
      user: updated,
    };
  }
}
