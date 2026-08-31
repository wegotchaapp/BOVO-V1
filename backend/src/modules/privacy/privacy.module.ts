import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { User } from '../../database/entities/user.entity';
import { Profile, Vehicle } from '../../database/entities/profile.entities';
import {
  Trip,
  TripPreference,
  TripZone,
} from '../../database/entities/trip.entities';
import {
  Booking,
  BookingLuggage,
  BookingStatusLog,
} from '../../database/entities/booking.entities';
import {
  Payment,
  Payout,
  Refund,
  InsurancePolicy,
} from '../../database/entities/payment.entities';
import {
  ChatConversation,
  ChatMessage,
  ChatBlock,
  CallRecord,
} from '../../database/entities/chat.entities';
import {
  TripPing,
  SosEvent,
  Report,
  ModerationAction,
  Suspension,
  Incident,
  DeviationEvent,
  Appeal,
} from '../../database/entities/safety.entities';
import {
  Verification,
  BackgroundCheck,
} from '../../database/entities/identity.entities';
import {
  Conversation,
  Message,
  NotificationLog,
  NotificationPreference,
  EmergencyContact,
  Device,
} from '../../database/entities/communication.entities';
import { AuditEvent } from '../../database/entities/audit.entity';
import { DriverTrip } from '../../database/entities/driver-trip.entity';
import { TripReply } from '../../database/entities/trip-reply.entity';
import { UserSession } from '../../database/entities/user-session.entity';
import { ComplianceLog } from '../../database/entities/compliance-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Profile,
      Vehicle,
      Trip,
      TripPreference,
      TripZone,
      Booking,
      BookingLuggage,
      BookingStatusLog,
      Payment,
      Payout,
      Refund,
      InsurancePolicy,
      ChatConversation,
      ChatMessage,
      ChatBlock,
      CallRecord,
      TripPing,
      SosEvent,
      Report,
      ModerationAction,
      Suspension,
      Incident,
      DeviationEvent,
      Appeal,
      Verification,
      BackgroundCheck,
      Conversation,
      Message,
      NotificationLog,
      NotificationPreference,
      EmergencyContact,
      Device,
      AuditEvent,
      DriverTrip,
      TripReply,
      UserSession,
      ComplianceLog,
    ]),
  ],
  controllers: [PrivacyController],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
