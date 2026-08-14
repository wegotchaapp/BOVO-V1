import 'dotenv/config';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Verification, BackgroundCheck } from './entities/identity.entities';
import { Profile, Vehicle } from './entities/profile.entities';
import { Trip, TripPreference, TripZone } from './entities/trip.entities';
import { Booking, BookingLuggage, BookingStatusLog } from './entities/booking.entities';
import { Payment, Payout, Refund, InsurancePolicy } from './entities/payment.entities';
import { TripPing, SosEvent, Report, ModerationAction, Suspension, Incident, DeviationEvent, Appeal } from './entities/safety.entities';
import { ChatConversation, ChatMessage, ChatBlock, CallRecord } from './entities/chat.entities';
import { Conversation, Message, NotificationLog, NotificationPreference, EmergencyContact, Device } from './entities/communication.entities';
import { AuditEvent } from './entities/audit.entity';
import { SavedSearch } from './entities/saved-search.entity';
import { DriverTrip } from './entities/driver-trip.entity';
import { SupportAgent } from './entities/support-agent.entity';
import { SupportTicket } from './entities/support-ticket.entity';
import { SupportTicketMessage } from './entities/support-ticket-message.entity';
import { SupportSession } from './entities/support-session.entity';
import { UserSession } from './entities/user-session.entity';
import { TripGroup, TripGroupMember, TripGroupMessage, TripGroupPickupApproval } from './entities/trip-group.entity';
import { TripReply, TripReplyRead } from './entities/trip-reply.entity';
import { ComplianceLog } from './entities/compliance-log.entity';
import {
  MobileUser,
  MobileVehicle,
  MobileSession,
  MobileTrip,
  MobileTripReply,
  MobileTripReplyRead,
  MobileBooking,
  MobileRating,
  MobileTripGroup,
  MobileTripGroupMember,
  MobileTripGroupMessage,
  MobileDriverTrip,
  MobileConversation,
  MobileDirectMessage,
  MobileLiveLocation,
  MobileOdometerReading,
} from '../modules/mobile-api/entities/mobile.entities';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'false'
      ? false
      : process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
  entities: [
    User,
    RefreshToken,
    Verification,
    BackgroundCheck,
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
    TripPing,
    SosEvent,
    Report,
    ModerationAction,
    Suspension,
    Incident,
    DeviationEvent,
    Appeal,
    ChatConversation,
    ChatMessage,
    ChatBlock,
    CallRecord,
    Conversation,
    Message,
    NotificationLog,
    NotificationPreference,
    EmergencyContact,
    Device,
    AuditEvent,
    SavedSearch,
    DriverTrip,
    SupportAgent,
    SupportTicket,
    SupportTicketMessage,
    SupportSession,
    UserSession,
    TripGroup,
    TripGroupMember,
    TripGroupMessage,
    TripGroupPickupApproval,
    TripReply,
    TripReplyRead,
    ComplianceLog,
    MobileUser,
    MobileVehicle,
    MobileSession,
    MobileTrip,
    MobileTripReply,
    MobileTripReplyRead,
    MobileBooking,
    MobileRating,
    MobileTripGroup,
    MobileTripGroupMember,
    MobileTripGroupMessage,
    MobileDriverTrip,
    MobileConversation,
    MobileDirectMessage,
    MobileLiveLocation,
    MobileOdometerReading,
  ],
  // __filename ends in .js when compiled, .ts when running under ts-node.
  // This resolves to the correct migration files in both environments.
  migrations: [path.join(__dirname, 'migrations', __filename.endsWith('.js') ? '*.js' : '*.ts')],
  logging: true,
});
