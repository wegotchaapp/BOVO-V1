import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MobileBooking,
  MobileDriverTrip,
  MobileSession,
  MobileTrip,
  MobileTripGroup,
  MobileTripGroupMember,
  MobileTripGroupMessage,
  MobileTripReply,
  MobileTripReplyRead,
  MobileUser,
} from './entities/mobile.entities';
import { MobileAuthGuard } from './mobile-auth.guard';
import { MobileAuthService } from './services/mobile-auth.service';
import { MobileTripsService } from './services/mobile-trips.service';
import { MobileBookingsService } from './services/mobile-bookings.service';
import { MobileGroupsService } from './services/mobile-groups.service';
import { MobileEarningsService } from './services/mobile-earnings.service';
import { MobileSubscriptionsService } from './services/mobile-subscriptions.service';
import { MobileNotificationsService } from './services/mobile-notifications.service';
import { MobileAuthController } from './controllers/mobile-auth.controller';
import { MobileTripsController } from './controllers/mobile-trips.controller';
import { MobileBookingsController } from './controllers/mobile-bookings.controller';
import { MobileGroupsController } from './controllers/mobile-groups.controller';
import { MobileEarningsController } from './controllers/mobile-earnings.controller';
import { MobileSubscriptionsController } from './controllers/mobile-subscriptions.controller';
import { MobileNotificationsController } from './controllers/mobile-notifications.controller';

/**
 * Bovogo mobile compatibility layer. Serves the exact `/api/*` REST contract
 * the Replit-built Expo app expects, backed by isolated `mobile_*` tables, so
 * the published app and the platform's primary backend can share one NestJS
 * runtime without either side changing behavior.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MobileUser,
      MobileSession,
      MobileTrip,
      MobileTripReply,
      MobileTripReplyRead,
      MobileBooking,
      MobileTripGroup,
      MobileTripGroupMember,
      MobileTripGroupMessage,
      MobileDriverTrip,
    ]),
  ],
  controllers: [
    MobileAuthController,
    MobileTripsController,
    MobileBookingsController,
    MobileGroupsController,
    MobileEarningsController,
    MobileSubscriptionsController,
    MobileNotificationsController,
  ],
  providers: [
    MobileAuthGuard,
    MobileAuthService,
    MobileTripsService,
    MobileBookingsService,
    MobileGroupsService,
    MobileEarningsService,
    MobileSubscriptionsService,
    MobileNotificationsService,
  ],
})
export class MobileApiModule {}
