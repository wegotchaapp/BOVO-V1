import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  MobileBooking,
  MobileConversation,
  MobileDirectMessage,
  MobileDriverTrip,
  MobileLiveLocation,
  MobileOdometerReading,
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
import { MobileOdometerService } from './services/mobile-odometer.service';
import { MobileBackgroundCheckService } from './services/mobile-background-check.service';
import { MobileSubscriptionsService } from './services/mobile-subscriptions.service';
import { MobileNotificationsService } from './services/mobile-notifications.service';
import { MobileConversationsService } from './services/mobile-conversations.service';
import { MobileVehiclesService } from './services/mobile-vehicles.service';
import { MobileRatingsService } from './services/mobile-ratings.service';
import { MobileSafetyService } from './services/mobile-safety.service';
import { MobileEmailNotificationsService } from './services/mobile-email-notifications.service';
import { MobileAuthController } from './controllers/mobile-auth.controller';
import { MobileTripsController } from './controllers/mobile-trips.controller';
import { MobileBookingsController } from './controllers/mobile-bookings.controller';
import { MobileGroupsController } from './controllers/mobile-groups.controller';
import { MobileEarningsController } from './controllers/mobile-earnings.controller';
import { MobileOdometerController } from './controllers/mobile-odometer.controller';
import { MobileBackgroundCheckController } from './controllers/mobile-background-check.controller';
import { MobileSubscriptionsController } from './controllers/mobile-subscriptions.controller';
import { MobileNotificationsController } from './controllers/mobile-notifications.controller';
import { MobileConversationsController } from './controllers/mobile-conversations.controller';
import { MobileVehiclesController } from './controllers/mobile-vehicles.controller';
import { MobileRatingsController } from './controllers/mobile-ratings.controller';
import { MobilePreferencesController } from './controllers/mobile-preferences.controller';
import { MobileSafetyController } from './controllers/mobile-safety.controller';

/**
 * Bovogo mobile compatibility layer. Serves the exact `/api/*` REST contract
 * the Replit-built Expo app expects, backed by isolated `mobile_*` tables, so
 * the published app and the platform's primary backend can share one NestJS
 * runtime without either side changing behavior.
 */
@Module({
  imports: [
    NotificationsModule,
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
      MobileOdometerReading,
    ]),
  ],
  controllers: [
    MobileAuthController,
    MobileTripsController,
    MobileBookingsController,
    MobileGroupsController,
    MobileEarningsController,
    MobileOdometerController,
    MobileBackgroundCheckController,
    MobileSubscriptionsController,
    MobileNotificationsController,
    MobileConversationsController,
    MobileVehiclesController,
    MobileRatingsController,
    MobilePreferencesController,
    MobileSafetyController,
  ],
  providers: [
    MobileAuthGuard,
    MobileAuthService,
    MobileTripsService,
    MobileBookingsService,
    MobileGroupsService,
    MobileEarningsService,
    MobileOdometerService,
    MobileBackgroundCheckService,
    MobileSubscriptionsService,
    MobileNotificationsService,
    MobileConversationsService,
    MobileVehiclesService,
    MobileRatingsService,
    MobileSafetyService,
    MobileEmailNotificationsService,
  ],
})
export class MobileApiModule {}
