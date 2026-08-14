import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Booking, BookingLuggage, BookingStatusLog } from '../../database/entities/booking.entities';
import { Trip } from '../../database/entities/trip.entities';
import { User } from '../../database/entities/user.entity';
import { CreateBookingDto, CancelBookingDto } from './dto/booking.dto';
import { BookingStatus, TripStatus, VehicleCategory } from '../../common/enums';
import { PaymentsService } from '../payments/payments.service';
import { ChatService } from '../chat/chat.service';
import { calculateRefund } from '../../common/utils/refund-calculator';
import { AnalyticsService } from '../../common/services/analytics.service';
import { PinoLogger } from 'nestjs-pino';
import { PricingService } from '../pricing/pricing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PRICING, platformFeeForSubtotal } from '../pricing/pricing.config';

const luggageContributionCents = (type: string): number =>
  Math.round((PRICING.LUGGAGE_SURCHARGE[type] || 0) * 100);

const luggageInsurancePremiumCents = (luggage: { type: string; qty: number }[]): number =>
  luggage.reduce((sum, item) => {
    const premium = PRICING.LUGGAGE_INSURANCE_PREMIUMS[item.type] || 0;
    return sum + Math.round(premium * 100) * item.qty;
  }, 0);

const INSURANCE_PREMIUM_CENTS = Math.round(PRICING.INSURANCE_PREMIUM * 100);

/** Fee scales with the booking subtotal — see PRICING.PLATFORM_FEE_*. */
function platformFeeCents(subtotalCents: number): number {
  return Math.round(platformFeeForSubtotal(subtotalCents / 100) * 100);
}

const VEHICLE_LUGGAGE_CAPACITY: Record<string, number> = {
  compact: 3,
  standard_sedan: 5,
  suv_crossover: 7,
  large_suv: 9,
  truck: 6,
  van: 10,
};

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(BookingLuggage)
    private readonly luggageRepo: Repository<BookingLuggage>,
    @InjectRepository(BookingStatusLog)
    private readonly statusLogRepo: Repository<BookingStatusLog>,
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
    private readonly chatService: ChatService,
    private readonly pricingService: PricingService,
    private readonly analyticsService: AnalyticsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createBooking(riderId: string, dto: CreateBookingDto): Promise<{ client_secret: string; booking_id: string }> {
    const trip = await this.tripRepo.findOne({
      where: { id: dto.trip_id },
      relations: ['vehicle'],
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status !== TripStatus.POSTED) throw new BadRequestException('Trip no longer available');
    if (trip.seats_available < dto.seats) throw new BadRequestException('Not enough seats available');

    this.validateLuggageCompatibility(dto.luggage, trip.vehicle?.category);

    const luggageTotalCents = dto.luggage.reduce((sum, item) => {
      return sum + luggageContributionCents(item.type) * item.qty;
    }, 0);

    const insuranceCostCents = dto.insurance_opted_in ? INSURANCE_PREMIUM_CENTS : 0;
    const luggageInsuranceCents = dto.luggage_insurance_opted_in
      ? luggageInsurancePremiumCents(dto.luggage)
      : 0;
    const perSeatCents = Math.round(this.pricingService.calculateSeatPrice(
      Number(trip.distance_miles) || 165,
    ) * 100);
    const rideCostCents = perSeatCents * dto.seats;
    // The fee scales with everything else in the booking, because Stripe's
    // percentage applies to the whole captured amount.
    const subtotalCents =
      rideCostCents + luggageTotalCents + insuranceCostCents + luggageInsuranceCents;
    const feeCents = platformFeeCents(subtotalCents);
    const totalCents = subtotalCents + feeCents;

    const { client_secret, payment_intent_id } = await this.paymentsService.createPaymentIntent(totalCents, {
      booking_type: 'carpool',
      rider_id: riderId,
      trip_id: trip.id,
    });

    const booking = this.bookingRepo.create({
      trip_id: trip.id,
      rider_id: riderId,
      seats: dto.seats,
      total_price: totalCents / 100,
      insurance_opted_in: dto.insurance_opted_in || false,
      luggage_insurance_opted_in: dto.luggage_insurance_opted_in || false,
      status: BookingStatus.PENDING,
      payment_intent_id,
    });

    const saved = await this.bookingRepo.save(booking);

    if (dto.insurance_opted_in === false) {
      this.analyticsService.track(riderId, 'insurance_declined', {
        trip_id: trip.id,
        booking_id: saved.id,
        premium_cents: INSURANCE_PREMIUM_CENTS,
        route: `${trip.origin_metro} -> ${trip.dest_metro}`,
      });
    }

    if (dto.luggage_insurance_opted_in) {
      const liPremiumCents = luggageInsurancePremiumCents(dto.luggage);
      this.analyticsService.track(riderId, 'luggage_insurance_purchased', {
        trip_id: trip.id,
        booking_id: saved.id,
        premium_cents: liPremiumCents,
        luggage: dto.luggage,
      });
    }

    for (const item of dto.luggage) {
      const luggage = this.luggageRepo.create({
        booking_id: saved.id,
        type: item.type,
        quantity: item.qty,
      });
      await this.luggageRepo.save(luggage);
    }

    await this.logStatusChange(saved.id, null, BookingStatus.PENDING, riderId, 'booking_created');

    await this.paymentsService.recordPayment(saved.id, payment_intent_id, totalCents, 'pending');

    this.logger.info(
      { bookingId: saved.id, riderId, tripId: trip.id, totalCents },
      'Booking created with payment intent',
    );

    return {
      client_secret,
      booking_id: saved.id,
    };
  }

  async confirmPayment(bookingId: string): Promise<{ message: string }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!booking.payment_intent_id) throw new BadRequestException('No payment intent found');

    const trip = booking.trip;
    if (!trip) throw new NotFoundException('Trip not found');

    booking.status = BookingStatus.CONFIRMED;
    await this.bookingRepo.save(booking);

    await this.logStatusChange(bookingId, BookingStatus.PENDING, BookingStatus.CONFIRMED, booking.rider_id, 'payment_confirmed');

    await this.chatService.ensureConversation(bookingId, [trip.driver_id, booking.rider_id]);

    await this.notificationsService.send(
      trip.driver_id,
      'booking_confirmed',
      'New Booking!',
      `${booking.seats} seat(s) booked by a sailor for your trip to ${trip.dest_metro}`,
      { booking_id: bookingId, trip_id: trip.id },
      'high',
    );

    this.logger.info({ bookingId }, 'Payment confirmed, booking confirmed');

    return { message: 'Payment confirmed and booking created' };
  }

  async driverAccept(bookingId: string, driverId: string): Promise<{ message: string }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const trip = booking.trip;
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.driver_id !== driverId) throw new ForbiddenException('Only the trip driver can accept bookings');

    booking.status = BookingStatus.CONFIRMED;
    await this.bookingRepo.save(booking);

    await this.logStatusChange(bookingId, BookingStatus.PENDING, BookingStatus.CONFIRMED, driverId, 'driver_accepted');

    await this.chatService.ensureConversation(bookingId, [trip.driver_id, booking.rider_id]);

    await this.notificationsService.send(
      booking.rider_id,
      'booking_confirmed',
      'Booking Accepted!',
      `Your booking for ${trip.origin_metro} → ${trip.dest_metro} has been accepted by the voyager.`,
      { booking_id: bookingId, trip_id: trip.id },
      'high',
    );

    this.logger.info({ bookingId, driverId }, 'Driver accepted booking');

    return { message: 'Booking accepted' };
  }

  async driverDecline(bookingId: string, driverId: string): Promise<{ message: string; refund_amount: number }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const trip = booking.trip;
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.driver_id !== driverId) throw new ForbiddenException('Only the trip driver can decline bookings');

    if (booking.payment_intent_id) {
      await this.paymentsService.cancelPaymentIntent(booking.payment_intent_id);
    }

    booking.status = BookingStatus.DECLINED;
    await this.bookingRepo.save(booking);

    trip.seats_available += booking.seats;
    await this.tripRepo.save(trip);

    await this.logStatusChange(bookingId, BookingStatus.PENDING, BookingStatus.DECLINED, driverId, 'driver_declined');

    this.logger.info({ bookingId, driverId }, 'Driver declined booking, payment cancelled');

    return { message: 'Booking declined', refund_amount: booking.total_price };
  }

  async capturePayment(bookingId: string, driverId: string): Promise<{ message: string }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const trip = booking.trip;
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.driver_id !== driverId) throw new ForbiddenException('Only the trip driver can capture payment');

    if (booking.payment_intent_id) {
      await this.paymentsService.capturePayment(booking.payment_intent_id);
    }

    if (booking.insurance_opted_in) {
      await this.paymentsService.activateInsurancePolicy(bookingId);
    }

    booking.status = BookingStatus.EN_ROUTE;
    await this.bookingRepo.save(booking);

    await this.logStatusChange(bookingId, BookingStatus.CONFIRMED, BookingStatus.EN_ROUTE, driverId, 'departing_captured');

    this.logger.info({ bookingId, driverId }, 'Payment captured, insurance activated, booking en_route');

    return { message: 'Payment captured, trip departing' };
  }

  async cancelBooking(riderId: string, bookingId: string, dto: CancelBookingDto): Promise<{ message: string; refund_amount: number; refund_percentage: number }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip', 'rider'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.rider_id !== riderId) throw new ForbiddenException('Only the rider can cancel this booking');

    const trip = booking.trip;
    if (!trip) throw new NotFoundException('Trip not found');

    const departureDate = new Date(`${trip.departure_date}T${trip.departure_time}`);
    const hoursUntilDeparture = (departureDate.getTime() - Date.now()) / (1000 * 60 * 60);

    const isCaptured = booking.status === BookingStatus.EN_ROUTE || booking.status === BookingStatus.COMPLETED;

    const driverCancellationCount = await this.getUserCancellationCount(trip.driver_id);

    const refundResult = calculateRefund({
      totalPaidCents: Math.round(booking.total_price * 100),
      hoursUntilDeparture,
      isDriverCancelling: dto.cancelled_by_driver || false,
      isSafetyReason: dto.safety_reason || false,
      isCaptured,
      driverCancellationCount,
      insuranceOptedIn: booking.insurance_opted_in,
    });

    const cancellerId = dto.cancelled_by_driver ? trip.driver_id : riderId;

    if (isCaptured && refundResult.requiresRefund && refundResult.refundAmountCents > 0) {
      const payment = await this.paymentsService.getPaymentByBooking(bookingId);

      if (payment) {
        const { refund_id } = await this.paymentsService.refundPayment(
          booking.payment_intent_id!,
          refundResult.refundAmountCents,
          refundResult.reason,
        );
        await this.paymentsService.recordRefund(
          payment.id,
          refundResult.refundAmountCents,
          refundResult.reason,
          refund_id,
        );
      }
    } else if (!isCaptured && refundResult.requiresRefund && booking.payment_intent_id) {
      if (refundResult.refundPercentage === 100) {
        await this.paymentsService.cancelPaymentIntent(booking.payment_intent_id);
      } else {
        await this.paymentsService.cancelPaymentIntent(booking.payment_intent_id);
      }
    }

    booking.status = BookingStatus.CANCELLED;
    await this.bookingRepo.save(booking);

    trip.seats_available += booking.seats;
    await this.tripRepo.save(trip);

    await this.logStatusChange(bookingId, booking.status, BookingStatus.CANCELLED, cancellerId, dto.reason);

    if (dto.cancelled_by_driver) {
      await this.incrementDriverCancellationCount(trip.driver_id);
    }

    this.logger.info(
      { bookingId, refundAmount: refundResult.refundAmountCents, reason: refundResult.reason },
      'Booking cancelled with refund calculation',
    );

    return {
      message: 'Booking cancelled',
      refund_amount: refundResult.refundAmountCents / 100,
      refund_percentage: refundResult.refundPercentage,
    };
  }

  async completeBooking(bookingId: string, driverId: string): Promise<{ message: string }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip', 'trip.vehicle'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const trip = booking.trip;
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.driver_id !== driverId) throw new ForbiddenException('Only the trip driver can complete this booking');

    booking.status = BookingStatus.COMPLETED;
    await this.bookingRepo.save(booking);

    await this.logStatusChange(bookingId, BookingStatus.EN_ROUTE, BookingStatus.COMPLETED, driverId, 'trip_completed');

    if (booking.insurance_opted_in) {
      const premiumCents = Math.round(PRICING.INSURANCE_PREMIUM * 100);
      await this.paymentsService.remitToMGA(bookingId, premiumCents);
    }

    if (booking.luggage_insurance_opted_in) {
      const luggageItems = await this.luggageRepo.find({ where: { booking_id: bookingId } });
      const totalLuggagePremiumCents = luggageInsurancePremiumCents(
        luggageItems.map((i) => ({ type: i.type, qty: i.quantity })),
      );
      await this.paymentsService.remitToMGA(bookingId, totalLuggagePremiumCents, 'luggage_insurance');
    }

    const luggageItems = await this.luggageRepo.find({ where: { booking_id: bookingId } });
    const luggageTotalCents = luggageItems.reduce(
      (sum, item) => sum + luggageContributionCents(item.type) * item.quantity,
      0,
    );
    const perSeatCents = Number(trip.per_seat_price) * 100;
    const payoutAmountCents = Math.round(perSeatCents * booking.seats) + luggageTotalCents;
    const payoutScheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.paymentsService.schedulePayout(
      trip.driver_id,
      bookingId,
      payoutAmountCents,
      payoutScheduledFor,
    );

    await this.userRepo.increment({ id: trip.driver_id }, 'total_trips', 1);

    this.logger.info(
      { bookingId, payoutAmountCents, scheduledFor: payoutScheduledFor },
      'Booking completed, payout scheduled for 24h later',
    );

    return { message: 'Trip completed, payout scheduled' };
  }

  async getMyBookings(userId: string): Promise<Booking[]> {
    return this.bookingRepo.find({
      where: { rider_id: userId },
      relations: ['trip', 'trip.driver', 'trip.vehicle'],
      order: { created_at: 'DESC' },
    });
  }

  async getDriverUpcomingBookings(driverId: string): Promise<Booking[]> {
    return this.bookingRepo.find({
      where: {
        trip: { driver_id: driverId },
        status: BookingStatus.CONFIRMED,
      },
      relations: ['trip'],
      order: { created_at: 'ASC' },
    });
  }

  async uploadVideoCheck(bookingId: string, driverId: string, base64Video: string, mimeType: string): Promise<{ message: string }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const trip = booking.trip;
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.driver_id !== driverId) throw new ForbiddenException('Only the trip driver can upload video check');

    const buffer = Buffer.from(base64Video, 'base64');
    const MAX_VIDEO_BYTES = 2097152;
    if (buffer.length > MAX_VIDEO_BYTES) {
      throw new BadRequestException(`Video exceeds maximum size of 2MB (${(buffer.length / (1024 * 1024)).toFixed(1)}MB uploaded)`);
    }

    this.logger.info({ bookingId, driverId, sizeBytes: buffer.length }, '360° vehicle check-in video received');

    return { message: 'Video check-in recorded' };
  }

  async getDriverBookings(driverId: string): Promise<Booking[]> {
    return this.bookingRepo.find({
      where: { trip: { driver_id: driverId } },
      relations: ['trip', 'trip.vehicle', 'rider'],
      order: { created_at: 'DESC' },
    });
  }

  async getBooking(bookingId: string): Promise<Booking | null> {
    return this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip', 'trip.driver', 'trip.vehicle', 'rider', 'luggage'],
    });
  }

  private validateLuggageCompatibility(luggage: { type: string; qty: number }[], vehicleCategory?: string): void {
    if (!vehicleCategory) return;

    const maxCapacity = VEHICLE_LUGGAGE_CAPACITY[vehicleCategory as VehicleCategory] || 5;
    const weightedTotal = luggage.reduce((sum, item) => {
      const weight = item.type === 'large' ? 2 : item.type === 'oversized' ? 3 : 1;
      return sum + item.qty * weight;
    }, 0);

    if (weightedTotal > maxCapacity) {
      throw new BadRequestException(
        `Luggage exceeds vehicle capacity. This ${vehicleCategory.replace('_', ' ')} can hold up to ${maxCapacity} standard bags.`,
      );
    }
  }

  private async logStatusChange(
    bookingId: string,
    from: string | null,
    to: string,
    changedBy: string,
    reason?: string,
  ): Promise<void> {
    const log = this.statusLogRepo.create({
      booking_id: bookingId,
      from_status: from || 'none',
      to_status: to,
      changed_by: changedBy,
      reason,
    });
    await this.statusLogRepo.save(log);
  }

  private async getUserCancellationCount(userId: string): Promise<number> {
    const result = await this.tripRepo
      .createQueryBuilder('trip')
      .select('COUNT(trip.id)', 'count')
      .where('trip.driver_id = :userId', { userId })
      .andWhere('trip.status = :status', { status: TripStatus.CANCELLED })
      .getRawOne();

    return result?.count ? parseInt(result.count, 10) : 0;
  }

  private async incrementDriverCancellationCount(driverId: string): Promise<void> {
    this.logger.info({ driverId }, 'Driver cancellation count incremented');
  }
}
