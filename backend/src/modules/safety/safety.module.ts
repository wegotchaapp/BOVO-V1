import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { SafetyController } from './safety.controller';
import { NoonlightWebhookController } from './noonlight-webhook.controller';
import { SafetyService } from './safety.service';
import { SafetyJobProcessor } from './processors/safety.processor';
import { SafetyScheduler } from './safety.scheduler';
import {
  TripPing,
  SosEvent,
  Incident,
  DeviationEvent,
} from '../../database/entities/safety.entities';
import { Booking } from '../../database/entities/booking.entities';
import { Trip } from '../../database/entities/trip.entities';
import { User } from '../../database/entities/user.entity';
import { EmergencyContact } from '../../database/entities/communication.entities';
import { MobileSosEvent } from '../mobile-api/entities/mobile.entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { NoonlightModule } from '../noonlight/noonlight.module';
import { RoutingModule } from '../routing/routing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TripPing,
      SosEvent,
      Incident,
      DeviationEvent,
      Booking,
      Trip,
      User,
      EmergencyContact,
      MobileSosEvent,
    ]),
    BullModule.registerQueue({ name: 'safety-jobs' }),
    forwardRef(() => NotificationsModule),
    NoonlightModule,
    RoutingModule,
  ],
  controllers: [SafetyController, NoonlightWebhookController],
  providers: [SafetyService, SafetyJobProcessor, SafetyScheduler],
  exports: [SafetyService],
})
export class SafetyModule {}
