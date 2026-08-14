import {
  Body,
  Controller,
  Get,
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
import { MobileBackgroundCheckService } from '../services/mobile-background-check.service';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/background-check')
export class MobileBackgroundCheckController {
  constructor(private readonly checks: MobileBackgroundCheckService) {}

  /** Returns a Checkr hosted invitation URL; SSN is entered there, not here. */
  @Post('start')
  @HttpCode(HttpStatus.OK)
  @UseGuards(MobileAuthGuard)
  start(@MobileAuthUser() user: MobileUser) {
    return this.checks.startCheck(user);
  }

  @Get('status')
  @UseGuards(MobileAuthGuard)
  status(@MobileAuthUser() user: MobileUser) {
    return this.checks.status(user);
  }

  /**
   * Checkr webhook. Unauthenticated by design — Checkr signs requests rather
   * than carrying a session. Signature verification belongs here before
   * production traffic is pointed at it.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(@Body() payload: Record<string, unknown>) {
    return this.checks.handleWebhook(payload as never);
  }
}
