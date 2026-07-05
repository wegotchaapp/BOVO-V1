import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MobileBooking,
  MobileConversation,
  MobileDirectMessage,
  MobileDriverTrip,
  MobileLiveLocation,
  MobileRating,
  MobileSession,
  MobileTrip,
  MobileTripGroup,
  MobileTripGroupMember,
  MobileTripGroupMessage,
  MobileTripReply,
  MobileTripReplyRead,
  MobileUser,
  MobileVehicle,
} from './entities/mobile.entities';
import { MobileAuthGuard } from './mobile-auth.guard';
import { MobileAuthService } from './services/mobile-auth.service';
import { MobileTripsService } from './services/mobile-trips.service';
import { MobileBookingsService } from './services/mobile-bookings.service';
import { MobileGroupsService } from './services/mobile-groups.service';
import { MobileEarningsService } from './services/mobile-earnings.service';
import { MobileSubscriptionsService } from './services/mobile-subscriptions.service';
import { MobileNotificationsService } from './services/mobile-notifications.service';
import { MobileConversationsService } from './services/mobile-conversations.service';
import { MobileVehiclesService } from './services/mobile-vehicles.service';
import { MobileRatingsService } from './services/mobile-ratings.service';
import { MobileAuthController } from './controllers/mobile-auth.controller';
import { MobileTripsController } from './controllers/mobile-trips.controller';
import { MobileBookingsController } from './controllers/mobile-bookings.controller';
import { MobileGroupsController } from './controllers/mobile-groups.controller';
import { MobileEarningsController } from './controllers/mobile-earnings.controller';
import { MobileSubscriptionsController } from './controllers/mobile-subscriptions.controller';
import { MobileNotificationsController } from './controllers/mobile-notifications.controller';
import { MobileConversationsController } from './controllers/mobile-conversations.controller';
import { MobileVehiclesController } from './controllers/mobile-vehicles.controller';
import { MobileRatingsController } from './controllers/mobile-ratings.controller';
import { MobilePreferencesController } from './controllers/mobile-preferences.controller';

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
      MobileLiveLocation,
      MobileConversation,
      MobileDirectMessage,
      MobileVehicle,
      MobileRating,
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
    MobileConversationsController,
    MobileVehiclesController,
    MobileRatingsController,
    MobilePreferencesController,
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
    MobileConversationsService,
    MobileVehiclesService,
    MobileRatingsService,
  ],
})
export class MobileApiModule {}
