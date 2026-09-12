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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { UseFilters } from '@nestjs/common';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import {
  MobileTripsService,
  UploadedVideoFile,
} from '../services/mobile-trips.service';
import { CreateTripBody } from '../dto/mobile.dto';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/trips')
@UseGuards(MobileAuthGuard)
export class MobileTripsController {
  constructor(private readonly trips: MobileTripsService) {}

  @Get()
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    // ISO date (YYYY-MM-DD). The Sailor picks a day on the search card and the
    // results header states it, so the query has to honour it — previously the
    // date was passed as a display label only and never reached the server.
    @Query('date') date?: string,
  ) {
    return this.trips.list(from, to, date);
  }

  @Get('mine')
  mine(@MobileAuthUser() user: MobileUser) {
    return this.trips.mine(user.id);
  }

  @Get(':id')
  getOne(@MobileAuthUser() user: MobileUser, @Param('id') id: string) {
    return this.trips.getOne(id, user.id);
  }

  @Post()
  create(@MobileAuthUser() user: MobileUser, @Body() dto: CreateTripBody) {
    return this.trips.create(user.id, dto);
  }

  @Delete(':id')
  cancel(@MobileAuthUser() user: MobileUser, @Param('id') id: string) {
    return this.trips.cancel(user.id, id);
  }

  @Post(':id/start-video')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('video', {
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  uploadStartVideo(
    @MobileAuthUser() user: MobileUser,
    @Param('id') id: string,
    @UploadedFile() video: UploadedVideoFile | undefined,
  ) {
    return this.trips.uploadStartVideo(user.id, id, video);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  start(@MobileAuthUser() user: MobileUser, @Param('id') id: string) {
    return this.trips.start(user.id, id);
  }

  /**
   * Replies on adventures are switched off. The route stays so an older build
   * gets a clear refusal rather than a 404, and the service refuses every call.
   */
  @Post(':id/replies')
  reply() {
    return this.trips.reply();
  }

  @Post(':id/mark-read')
  @HttpCode(HttpStatus.OK)
  markRead(@MobileAuthUser() user: MobileUser, @Param('id') id: string) {
    return this.trips.markRead(user.id, id);
  }
}
