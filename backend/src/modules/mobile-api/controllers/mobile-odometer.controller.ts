import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';

import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';
import {
  MobileOdometerService,
  UploadedPhotoFile,
} from '../services/mobile-odometer.service';
import { RecordOdometerBody } from '../dto/mobile.dto';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/trips')
@UseGuards(MobileAuthGuard)
export class MobileOdometerController {
  constructor(private readonly odometer: MobileOdometerService) {}

  /** Who's on board and where each Sailor is in their pickup/dropoff cycle. */
  @Get(':id/manifest')
  manifest(@MobileAuthUser() user: MobileUser, @Param('id') id: string) {
    return this.odometer.manifest(user.id, id);
  }

  /**
   * Multipart: `photo` file plus the reading fields. Sent as multipart rather
   * than JSON so the odometer image never has to be base64-inflated.
   */
  @Post(':id/odometer')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  )
  record(
    @MobileAuthUser() user: MobileUser,
    @Param('id') id: string,
    @Body() body: RecordOdometerBody,
    @UploadedFile() photo: UploadedPhotoFile | undefined,
  ) {
    return this.odometer.record(
      user.id,
      id,
      {
        bookingId: body.bookingId,
        kind: body.kind,
        // Multipart fields arrive as strings.
        miles: Number(body.miles),
        latitude: body.latitude != null ? Number(body.latitude) : undefined,
        longitude: body.longitude != null ? Number(body.longitude) : undefined,
      },
      photo,
    );
  }
}
