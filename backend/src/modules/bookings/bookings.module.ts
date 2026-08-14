import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { Booking, BookingLuggage, BookingStatusLog } from '../../database/entities/booking.entities';
import { Trip } from '../../database/entities/trip.entities';
import { User } from '../../database/entities/user.entity';
import { PaymentsModule } from '../payments/payments.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';

import { AnalyticsService } from '../../common/services/analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, BookingLuggage, BookingStatusLog, Trip, User]),
    PaymentsModule,
    ChatModule,
    NotificationsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, AnalyticsService],
  exports: [BookingsService],
})
export class BookingsModule {}
