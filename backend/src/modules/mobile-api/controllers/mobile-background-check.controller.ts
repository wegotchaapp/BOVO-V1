import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseFilters,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

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

  /** Checkr authenticates this callback with an HMAC, not a user session. */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('x-checkr-signature') signature?: string,
    @Body() payload?: Record<string, unknown>,
  ) {
    if (!this.checks.isValidWebhookSignature(request.rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    return this.checks.handleWebhook(payload ?? {});
  }
}
