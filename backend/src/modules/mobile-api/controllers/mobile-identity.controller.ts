import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFiles,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';

import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';
import {
  IdentityUpload,
  MobileIdentityService,
} from '../services/mobile-identity.service';
import { SubmitIdentityVerificationBody } from '../dto/mobile.dto';

/** 12 MB is a generous phone photo; anything larger is a mistake. */
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/identity')
@UseGuards(MobileAuthGuard)
export class MobileIdentityController {
  constructor(private readonly identity: MobileIdentityService) {}

  @Get('verification')
  latest(@MobileAuthUser() user: MobileUser) {
    return this.identity.latest(user.id);
  }

  /**
   * Multipart: `documentType`, plus the files `idFront`, `selfie`, and `idBack`
   * for anything that is not a passport.
   */
  @Post('verification')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'idFront', maxCount: 1 },
        { name: 'idBack', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_IMAGE_BYTES } },
    ),
  )
  submit(
    @MobileAuthUser() user: MobileUser,
    @Body() dto: SubmitIdentityVerificationBody,
    @UploadedFiles() files: IdentityUpload | undefined,
  ) {
    return this.identity.submit(user.id, dto, files ?? {});
  }
}
