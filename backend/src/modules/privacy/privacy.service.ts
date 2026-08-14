import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Profile, Vehicle } from '../../database/entities/profile.entities';
import { Trip, TripPreference, TripZone } from '../../database/entities/trip.entities';
import { Booking, BookingLuggage, BookingStatusLog } from '../../database/entities/booking.entities';
import { Payment, Payout, Refund, InsurancePolicy } from '../../database/entities/payment.entities';
import { ChatConversation, ChatMessage, ChatBlock, CallRecord } from '../../database/entities/chat.entities';
import { TripPing, SosEvent, Report, ModerationAction, Suspension, Incident, DeviationEvent, Appeal } from '../../database/entities/safety.entities';
import { Verification, BackgroundCheck } from '../../database/entities/identity.entities';
import { Conversation, Message, NotificationLog, NotificationPreference, EmergencyContact, Device } from '../../database/entities/communication.entities';
import { AuditEvent } from '../../database/entities/audit.entity';
import { DriverTrip } from '../../database/entities/driver-trip.entity';
import { TripReply } from '../../database/entities/trip-reply.entity';
import { UserSession } from '../../database/entities/user-session.entity';
import { ComplianceLog } from '../../database/entities/compliance-log.entity';
import { PinoLogger } from 'nestjs-pino';
import { v4 as uuid } from 'uuid';

@Injectable()
export class PrivacyService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(TripPreference) private readonly tripPrefRepo: Repository<TripPreference>,
    @InjectRepository(TripZone) private readonly tripZoneRepo: Repository<TripZone>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(BookingLuggage) private readonly bookingLuggageRepo: Repository<BookingLuggage>,
    @InjectRepository(BookingStatusLog) private readonly bookingLogRepo: Repository<BookingStatusLog>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Payout) private readonly payoutRepo: Repository<Payout>,
    @InjectRepository(Refund) private readonly refundRepo: Repository<Refund>,
    @InjectRepository(InsurancePolicy) private readonly insuranceRepo: Repository<InsurancePolicy>,
    @InjectRepository(ChatConversation) private readonly chatConvRepo: Repository<ChatConversation>,
    @InjectRepository(ChatMessage) private readonly chatMsgRepo: Repository<ChatMessage>,
    @InjectRepository(ChatBlock) private readonly chatBlockRepo: Repository<ChatBlock>,
    @InjectRepository(CallRecord) private readonly callRecordRepo: Repository<CallRecord>,
    @InjectRepository(TripPing) private readonly pingRepo: Repository<TripPing>,
    @InjectRepository(SosEvent) private readonly sosRepo: Repository<SosEvent>,
    @InjectRepository(Report) private readonly reportRepo: Repository<Report>,
    @InjectRepository(ModerationAction) private readonly modActionRepo: Repository<ModerationAction>,
    @InjectRepository(Suspension) private readonly suspensionRepo: Repository<Suspension>,
    @InjectRepository(Incident) private readonly incidentRepo: Repository<Incident>,
    @InjectRepository(DeviationEvent) private readonly deviationRepo: Repository<DeviationEvent>,
    @InjectRepository(Appeal) private readonly appealRepo: Repository<Appeal>,
    @InjectRepository(Verification) private readonly verificationRepo: Repository<Verification>,
    @InjectRepository(BackgroundCheck) private readonly bgCheckRepo: Repository<BackgroundCheck>,
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
    @InjectRepository(NotificationLog) private readonly notifLogRepo: Repository<NotificationLog>,
    @InjectRepository(NotificationPreference) private readonly notifPrefRepo: Repository<NotificationPreference>,
    @InjectRepository(EmergencyContact) private readonly emergencyRepo: Repository<EmergencyContact>,
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
    @InjectRepository(AuditEvent) private readonly auditRepo: Repository<AuditEvent>,
    @InjectRepository(DriverTrip) private readonly driverTripRepo: Repository<DriverTrip>,
    @InjectRepository(TripReply) private readonly tripReplyRepo: Repository<TripReply>,
    @InjectRepository(UserSession) private readonly userSessionRepo: Repository<UserSession>,
    @InjectRepository(ComplianceLog) private readonly complianceLogRepo: Repository<ComplianceLog>,
    private readonly logger: PinoLogger,
  ) {}

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const profile = await this.profileRepo.findOne({ where: { user_id: userId } });
    const vehicles = await this.vehicleRepo.find({ where: { driver_id: userId } });
    const trips = await this.tripRepo.find({ where: { driver_id: userId } });
    const bookingsAsRider = await this.bookingRepo.find({ where: { rider_id: userId } });
    const bookingsAsDriver = await this.bookingRepo.find({
      relations: ['trip'],
      where: { trip: { driver_id: userId } },
    });
    const payments = await this.paymentRepo.find({
      relations: ['booking'],
      where: { booking: { rider_id: userId } },
    });
    const payouts = await this.payoutRepo.find({ where: { driver_id: userId } });
    const chatConversations = await this.chatConvRepo.find({
      where: { participant_ids: In([userId]) },
    });
    const chatMessages = await this.chatMsgRepo.find({
      where: { sender_id: userId },
    });
    const sosHistory = await this.sosRepo.find({ where: { user_id: userId } });
    const reports = await this.reportRepo.find({ where: { reporter_id: userId } });
    const incidents = await this.incidentRepo.find({ where: { user_id: userId } });
    const verifications = await this.verificationRepo.find({ where: { user_id: userId } });
    const bgChecks = await this.bgCheckRepo.find({ where: { user_id: userId } });
    const emergencyContacts = await this.emergencyRepo.find({ where: { user_id: userId } });
    const devices = await this.deviceRepo.find({ where: { user_id: userId } });
    const notifPrefs = await this.notifPrefRepo.findOne({ where: { user_id: userId } });
    const driverTrips = await this.driverTripRepo.find({ where: { driver_id: userId } });
    const tripReplies = await this.tripReplyRepo.find({ where: { user_id: userId } });
    const userSessions = await this.userSessionRepo.find({ where: { user_id: userId } });
    const complianceLogs = await this.complianceLogRepo.find({ where: { user_id: userId } });

    const { password_hash, ...safeUser } = user;

    return {
      export_date: new Date().toISOString(),
      user: safeUser,
      profile,
      vehicles,
      trips,
      bookings: { as_rider: bookingsAsRider, as_driver: bookingsAsDriver },
      payments,
      payouts,
      chat: { conversations: chatConversations, messages: chatMessages },
      safety: { sos_history: sosHistory, reports, incidents },
      identity: { verifications, background_checks: bgChecks },
      emergency_contacts: emergencyContacts,
      devices,
      notification_preferences: notifPrefs,
      driver_trips: driverTrips,
      trip_replies: tripReplies,
      user_sessions: userSessions,
      compliance_logs: complianceLogs,
      export_summary: {
        total_trips: trips.length,
        total_bookings: bookingsAsRider.length + bookingsAsDriver.length,
        total_payments: payments.length,
        total_sos_events: sosHistory.length,
        total_chat_messages: chatMessages.length,
        total_driver_trips: driverTrips.length,
        total_compliance_logs: complianceLogs.length,
      },
    };
  }

  async deleteUserData(userId: string): Promise<{ deleted: boolean; message: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    this.logger.info({ userId }, 'Processing user data deletion request');

    await this.emergencyRepo.softDelete({ user_id: userId });
    await this.deviceRepo.delete({ user_id: userId });
    await this.notifPrefRepo.delete({ user_id: userId });
    await this.notifLogRepo.delete({ user_id: userId });
    await this.sosRepo.delete({ user_id: userId });
    await this.incidentRepo.delete({ user_id: userId });
    await this.reportRepo.delete({ reporter_id: userId });
    await this.reportRepo.delete({ reported_user_id: userId });
    await this.appealRepo.delete({ user_id: userId });
    await this.suspensionRepo.delete({ user_id: userId });

    const chatConvs = await this.chatConvRepo.find({
      where: { participant_ids: In([userId]) },
    });
    if (chatConvs.length > 0) {
      const convIds = chatConvs.map((c) => c.id);
      await this.chatMsgRepo.delete({ conversation_id: In(convIds) });
      await this.chatConvRepo.delete({ id: In(convIds) });
    }

    await this.chatBlockRepo.delete({ blocker_id: userId });
    await this.chatBlockRepo.delete({ blocked_user_id: userId });
    await this.callRecordRepo.delete({ caller_id: userId });
    await this.callRecordRepo.delete({ receiver_id: userId });

    const vehicles = await this.vehicleRepo.find({ where: { driver_id: userId } });
    if (vehicles.length > 0) {
      const vehicleIds = vehicles.map((v) => v.id);
      await this.tripRepo.softDelete({ vehicle_id: In(vehicleIds) });
    }

    await this.vehicleRepo.softDelete({ driver_id: userId });

    const trips = await this.tripRepo.find({ where: { driver_id: userId } });
    if (trips.length > 0) {
      const tripIds = trips.map((t) => t.id);
      await this.tripPrefRepo.delete({ trip_id: In(tripIds) });
      await this.tripZoneRepo.delete({ trip_id: In(tripIds) });
    }

    await this.tripRepo.softDelete({ driver_id: userId });

    const bookingsAsRider = await this.bookingRepo.find({ where: { rider_id: userId } });
    if (bookingsAsRider.length > 0) {
      const bookingIds = bookingsAsRider.map((b) => b.id);
      await this.bookingLuggageRepo.delete({ booking_id: In(bookingIds) });
      await this.bookingLogRepo.delete({ booking_id: In(bookingIds) });
      await this.pingRepo.delete({ booking_id: In(bookingIds) });
      await this.deviationRepo.delete({ booking_id: In(bookingIds) });
      await this.insuranceRepo.delete({ booking_id: In(bookingIds) });
    }

    await this.bookingRepo.softDelete({ rider_id: userId });

    await this.payoutRepo.delete({ driver_id: userId });

    await this.verificationRepo.delete({ user_id: userId });
    await this.bgCheckRepo.delete({ user_id: userId });
    await this.driverTripRepo.delete({ driver_id: userId });
    await this.tripReplyRepo.delete({ user_id: userId });
    await this.userSessionRepo.delete({ user_id: userId });
    await this.complianceLogRepo.delete({ user_id: userId });

    await this.profileRepo.softDelete({ user_id: userId });

    await this.auditRepo.createQueryBuilder()
      .update()
      .set({ actor_id: null })
      .where('actor_id = :userId', { userId })
      .execute();

    await this.userRepo.softDelete(userId);

    this.logger.info({ userId }, 'User data deletion completed');

    return { deleted: true, message: 'Your data has been deleted. Audit logs are anonymized per regulatory requirements.' };
  }

  async requestDeletion(userId: string, reason: string): Promise<{ message: string; scheduled_at: Date; grace_period_days: number }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const gracePeriodDays = 30;
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + gracePeriodDays);

    (user as any).deletion_scheduled_at = scheduledAt.toISOString();
    (user as any).deletion_reason = reason;
    await this.userRepo.save(user);

    await this.complianceLogRepo.save(
      this.complianceLogRepo.create({
        id: uuid().replace(/-/g, '').slice(0, 32),
        user_id: userId,
        rule: 'CCPA_TEXAS_DELETION',
        action: 'deletion_requested',
        details: `Grace period until ${scheduledAt.toISOString()}. Reason: ${reason}`,
        triggered_at: new Date(),
      }),
    );

    this.logger.info({ userId, scheduledAt, reason }, 'Account deletion scheduled with grace period');

    return {
      message: `Your deletion request has been received. You have ${gracePeriodDays} days to cancel before data is permanently deleted.`,
      scheduled_at: scheduledAt,
      grace_period_days: gracePeriodDays,
    };
  }

  async cancelDeletion(userId: string): Promise<{ cancelled: boolean; message: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!(user as any).deletion_scheduled_at) {
      return { cancelled: false, message: 'No pending deletion request found.' };
    }

    (user as any).deletion_scheduled_at = null;
    (user as any).deletion_reason = null;
    await this.userRepo.save(user);

    await this.complianceLogRepo.save(
      this.complianceLogRepo.create({
        id: uuid().replace(/-/g, '').slice(0, 32),
        user_id: userId,
        rule: 'CCPA_TEXAS_DELETION',
        action: 'deletion_cancelled',
        details: 'User cancelled deletion request within grace period',
        triggered_at: new Date(),
      }),
    );

    this.logger.info({ userId }, 'Account deletion cancelled within grace period');

    return { cancelled: true, message: 'Your deletion request has been cancelled. Your account and data will be retained.' };
  }

  async processScheduledDeletions(): Promise<number> {
    const now = new Date().toISOString();
    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.deletion_scheduled_at IS NOT NULL')
      .andWhere('u.deletion_scheduled_at <= :now', { now })
      .getMany();

    for (const user of users) {
      try {
        await this.deleteUserData(user.id);
        this.logger.info({ userId: user.id }, 'Scheduled deletion processed');
      } catch (err) {
        this.logger.error({ userId: user.id, err }, 'Failed to process scheduled deletion');
      }
    }

    return users.length;
  }

  async deleteAccount(userId: string, reason: string): Promise<any> {
    return this.requestDeletion(userId, reason);
  }
}
