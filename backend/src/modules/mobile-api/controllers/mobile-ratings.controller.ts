import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MobileHttpExceptionFilter } from '../mobile-http-exception.filter';
import { MobileRatingsService } from '../services/mobile-ratings.service';
import { SubmitRatingBody } from '../dto/mobile.dto';
import { MobileAuthGuard, MobileAuthUser } from '../mobile-auth.guard';
import { MobileUser } from '../entities/mobile.entities';

@ApiTags('mobile')
@UseFilters(MobileHttpExceptionFilter)
@Controller('api/ratings')
@UseGuards(MobileAuthGuard)
export class MobileRatingsController {
  constructor(private readonly ratings: MobileRatingsService) {}

  @Get('status/:bookingId')
  status(
    @MobileAuthUser() user: MobileUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.ratings.status(user.id, bookingId);
  }

  @Post()
  submit(@MobileAuthUser() user: MobileUser, @Body() dto: SubmitRatingBody) {
    return this.ratings.submit(user.id, dto);
  }
}
