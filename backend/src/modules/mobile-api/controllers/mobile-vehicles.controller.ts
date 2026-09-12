import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
  MobileVehiclesService,
  UploadedFile as VehicleFile,
} from '../services/mobile-vehicles.service';
import {
  UploadVehicleDocumentBody,
  UploadVehiclePhotoBody,
  UpsertVehicleBody,
} from '../dto/mobile.dto';

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

  /** Registers another vehicle. A Voyager may have several. */
  @Post()
  create(@MobileAuthUser() user: MobileUser, @Body() dto: UpsertVehicleBody) {
    return this.vehicles.create(user.id, dto);
  }

  /** Edits a vehicle that has not been approved. Approved vehicles are locked. */
  @Put(':id')
  update(
    @MobileAuthUser() user: MobileUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertVehicleBody,
  ) {
    return this.vehicles.update(user.id, id, dto);
  }

  /** One of the five required photos. Multipart: `photo` file + `slot`. */
  @Post(':id/photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: 12 * 1024 * 1024 } }),
  )
  uploadPhoto(
    @MobileAuthUser() user: MobileUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UploadVehiclePhotoBody,
    @UploadedFile() photo: VehicleFile | undefined,
  ) {
    return this.vehicles.uploadPhoto(user.id, id, body.slot, photo);
  }

  /** Insurance certificate or vehicle registration. Multipart: `document`. */
  @Post(':id/document')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('document', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  uploadDocument(
    @MobileAuthUser() user: MobileUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UploadVehicleDocumentBody,
    @UploadedFile() document: VehicleFile | undefined,
  ) {
    return this.vehicles.uploadDocument(
      user.id,
      id,
      body.kind,
      body.expiresAt,
      document,
    );
  }

  @Get(':id')
  getOne(
    @MobileAuthUser() user: MobileUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vehicles.getOne(user.id, id);
  }
}
