import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';
import { MobileSafetyService } from '../services/mobile-safety.service';
import { SosBody } from '../dto/mobile.dto';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/safety')
@UseGuards(MobileAuthGuard)
export class MobileSafetyController {
  constructor(private readonly safety: MobileSafetyService) {}

  @Post('sos')
  @HttpCode(HttpStatus.OK)
  sos(@MobileAuthUser() user: MobileUser, @Body() dto: SosBody) {
    return this.safety.activateSos(user.id, dto);
  }
}
