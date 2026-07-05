import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Stripe from 'stripe';
import {
  MobileBooking,
  MobileLiveLocation,
  MobileTrip,
  MobileTripGroup,
  MobileTripGroupMember,
  MobileTripGroupMessage,
  MobileUser,
} from '../entities/mobile.entities';
import { CreateBookingBody, LiveLocationBody } from '../dto/mobile.dto';
import { bookingToDto } from '../mobile.mappers';
import { MobileConversationsService } from './mobile-conversations.service';

const SERVICE_FEE_RATE = 0.06;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class MobileBookingsService {
  constructor(
    @InjectRepository(MobileBooking)
    private readonly bookings: Repository<MobileBooking>,
    @InjectRepository(MobileTrip)
    private readonly trips: Repository<MobileTrip>,
    @InjectRepository(MobileUser)
    private readonly users: Repository<MobileUser>,
    @InjectRepository(MobileTripGroup)
    private readonly groups: Repository<MobileTripGroup>,
    @InjectRepository(MobileLiveLocation)
    private readonly liveLocations: Repository<MobileLiveLocation>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly conversations: MobileConversationsService,
  ) {}

  private stripeOrNull(): Stripe | null {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!key || key.includes('mock') || key.includes('your-stripe')) {
      return null;
    }
    return new Stripe(key);
  }

  private publishableKeyOrNull(): string | null {
    const key = this.config.get<string>('STRIPE_PUBLISHABLE_KEY');
    if (!key || key.includes('mock') || key.includes('your-stripe')) {
      return null;
    }
    return key;
  }

  private requireStripe(): { stripe: Stripe; publishableKey: string } {
    const stripe = this.stripeOrNull();
    const publishableKey = this.publishableKeyOrNull();
    if (!stripe || !publishableKey) {
      throw new InternalServerErrorException('Payments are not configured');
    }
    return { stripe, publishableKey };
  }

  /**
   * Legacy instant-confirm path used when Stripe is not configured (local dev).
   * Prefer prepare() + confirm() when Stripe keys are set.
   */
  async create(riderId: string, dto: CreateBookingBody) {
    if (this.stripeOrNull()) {
      throw new BadRequestException(
        'Use /bookings/prepare and /bookings/confirm for paid bookings.',
      );
    }
    return this.finalizeBooking(riderId, dto, null);
  }

  /** Create a pending booking + Stripe PaymentIntent. Seats are reserved on confirm. */
  async prepare(riderId: string, dto: CreateBookingBody) {
    const { stripe, publishableKey } = this.requireStripe();

    const trip = await this.trips.findOne({ where: { id: dto.tripId } });
    if (!trip) throw new NotFoundException('Trip not found');
    this.assertTripBookable(trip, riderId, dto.seats);

    const pricePerSeat = Number(trip.price_per_seat);
    const subtotal = round2(pricePerSeat * dto.seats);
    const serviceFee = round2(subtotal * SERVICE_FEE_RATE);
    const totalAmount = round2(subtotal + serviceFee);
    const amountCents = Math.round(totalAmount * 100);
    if (amountCents < 50) {
      throw new BadRequestException('Booking total is too low to charge.');
    }

    const pending = await this.bookings.save(
      this.bookings.create({
        trip_id: trip.id,
        rider_id: riderId,
        seats: dto.seats,
        price_per_seat: pricePerSeat.toFixed(2),
        service_fee: serviceFee.toFixed(2),
        total_amount: totalAmount.toFixed(2),
        payment_method: dto.paymentMethod,
        status: 'pending',
        payment_intent_id: null,
      }),
    );

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        mobileBookingId: pending.id,
        tripId: trip.id,
        riderId,
      },
    });

    pending.payment_intent_id = paymentIntent.id;
    await this.bookings.save(pending);

    const driver = await this.users.findOne({ where: { id: trip.driver_id } });

    return {
      booking: bookingToDto(pending, trip, driver?.name ?? 'Voyager', null),
      clientSecret: paymentIntent.client_secret,
      publishableKey,
    };
  }

  /** After Payment Sheet succeeds, verify PI and confirm seats + group. */
  async confirm(riderId: string, bookingId: string) {
    const { stripe } = this.requireStripe();

    const booking = await this.bookings.findOne({ where: { id: bookingId } });
    if (!booking || booking.rider_id !== riderId) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status === 'confirmed') {
      const trip = await this.trips.findOne({ where: { id: booking.trip_id } });
      if (!trip) throw new NotFoundException('Trip not found');
      const driver = await this.users.findOne({
        where: { id: trip.driver_id },
      });
      const groupId = await this.findGroupIdForTrip(booking.trip_id);
      return {
        booking: bookingToDto(
          booking,
          trip,
          driver?.name ?? 'Voyager',
          groupId,
        ),
      };
    }
    if (booking.status !== 'pending') {
      throw new BadRequestException('This booking cannot be confirmed.');
    }
    if (!booking.payment_intent_id) {
      throw new BadRequestException('Missing payment for this booking.');
    }

    const pi = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
    if (pi.status !== 'succeeded') {
      throw new BadRequestException(
        `Payment is not complete (status: ${pi.status}).`,
      );
    }

    return this.dataSource.transaction(async (tx) => {
      const tripRepo = tx.getRepository(MobileTrip);
      const bookingRepo = tx.getRepository(MobileBooking);
      const userRepo = tx.getRepository(MobileUser);

      const trip = await tripRepo
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :id', { id: booking.trip_id })
        .getOne();

      if (!trip) throw new NotFoundException('Trip not found');
      this.assertTripBookable(trip, riderId, booking.seats);

      trip.seats_available = trip.seats_available - booking.seats;
      await tripRepo.save(trip);

      booking.status = 'confirmed';
      await bookingRepo.save(booking);

      const driver = await userRepo.findOne({ where: { id: trip.driver_id } });
      const groupId = await this.ensureGroupForBooking(tx, trip, riderId);

      return {
        booking: bookingToDto(
          booking,
          trip,
          driver?.name ?? 'Voyager',
          groupId,
        ),
        _tripLabel: `${trip.from_city.replace(/, TX$/i, '')} → ${trip.to_city.replace(/, TX$/i, '')}`,
        _driverId: trip.driver_id,
        _riderId: riderId,
      };
    }).then(async (result) => {
      await this.conversations
        .ensureForBooking(result._driverId, result._riderId, result._tripLabel)
        .catch(() => undefined);
      return { booking: result.booking };
    });
  }

  private async finalizeBooking(
    riderId: string,
    dto: CreateBookingBody,
    paymentIntentId: string | null,
  ) {
    return this.dataSource.transaction(async (tx) => {
      const tripRepo = tx.getRepository(MobileTrip);
      const bookingRepo = tx.getRepository(MobileBooking);
      const userRepo = tx.getRepository(MobileUser);

      const trip = await tripRepo
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :id', { id: dto.tripId })
        .getOne();

      if (!trip) throw new NotFoundException('Trip not found');
      this.assertTripBookable(trip, riderId, dto.seats);

      const pricePerSeat = Number(trip.price_per_seat);
      const subtotal = round2(pricePerSeat * dto.seats);
      const serviceFee = round2(subtotal * SERVICE_FEE_RATE);
      const totalAmount = round2(subtotal + serviceFee);

      trip.seats_available = trip.seats_available - dto.seats;
      await tripRepo.save(trip);

      const inserted = await bookingRepo.save(
        bookingRepo.create({
          trip_id: trip.id,
          rider_id: riderId,
          seats: dto.seats,
          price_per_seat: pricePerSeat.toFixed(2),
          service_fee: serviceFee.toFixed(2),
          total_amount: totalAmount.toFixed(2),
          payment_method: dto.paymentMethod,
          status: 'confirmed',
          payment_intent_id: paymentIntentId,
        }),
      );

      const driver = await userRepo.findOne({ where: { id: trip.driver_id } });
      const groupId = await this.ensureGroupForBooking(tx, trip, riderId);

      return {
        booking: bookingToDto(
          inserted,
          trip,
          driver?.name ?? 'Voyager',
          groupId,
        ),
        _tripLabel: `${trip.from_city.replace(/, TX$/i, '')} → ${trip.to_city.replace(/, TX$/i, '')}`,
        _driverId: trip.driver_id,
        _riderId: riderId,
      };
    }).then(async (result) => {
      await this.conversations
        .ensureForBooking(result._driverId, result._riderId, result._tripLabel)
        .catch(() => undefined);
      return { booking: result.booking };
    });
  }

  private assertTripBookable(
    trip: MobileTrip,
    riderId: string,
    seats: number,
  ) {
    if (trip.status !== 'active') {
      throw new BadRequestException('This trip is no longer available.');
    }
    if (trip.driver_id === riderId) {
      throw new BadRequestException("You can't book a seat on your own trip.");
    }
    if (trip.departure_at.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('This trip has already departed.');
    }
    if (trip.seats_available < seats) {
      throw new BadRequestException(
        `Only ${trip.seats_available} seat${
          trip.seats_available === 1 ? '' : 's'
        } left on this trip.`,
      );
    }
  }

  async mine(riderId: string) {
    const rows = await this.bookings.find({
      where: { rider_id: riderId },
      order: { created_at: 'DESC' },
    });
    const result = [];
    for (const b of rows) {
      if (b.status === 'pending') continue;
      const trip = await this.trips.findOne({ where: { id: b.trip_id } });
      if (!trip) continue;
      const driver = await this.users.findOne({
        where: { id: trip.driver_id },
      });
      const groupId = await this.findGroupIdForTrip(b.trip_id);
      result.push(bookingToDto(b, trip, driver?.name ?? 'Voyager', groupId));
    }
    return { bookings: result };
  }

  async getOne(userId: string, id: string) {
    const booking = await this.bookings.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    const trip = await this.trips.findOne({ where: { id: booking.trip_id } });
    if (!trip) throw new NotFoundException('Booking not found');
    if (booking.rider_id !== userId && trip.driver_id !== userId) {
      throw new NotFoundException('Booking not found');
    }
    const driver = await this.users.findOne({ where: { id: trip.driver_id } });
    const groupId =
      booking.status === 'confirmed'
        ? await this.findGroupIdForTrip(booking.trip_id)
        : null;
    return {
      booking: bookingToDto(
        booking,
        trip,
        driver?.name ?? 'Voyager',
        groupId,
      ),
    };
  }

  private async findGroupIdForTrip(tripId: string): Promise<string | null> {
    const group = await this.groups.findOne({ where: { trip_id: tripId } });
    return group?.id ?? null;
  }

  private async requireBookingParticipant(userId: string, bookingId: string) {
    const booking = await this.bookings.findOne({ where: { id: bookingId } });
    if (!booking || booking.status !== 'confirmed') {
      throw new NotFoundException('Booking not found');
    }
    const trip = await this.trips.findOne({ where: { id: booking.trip_id } });
    if (!trip) throw new NotFoundException('Booking not found');
    const isRider = booking.rider_id === userId;
    const isDriver = trip.driver_id === userId;
    if (!isRider && !isDriver) {
      throw new NotFoundException('Booking not found');
    }
    return { booking, trip, isRider, isDriver };
  }

  /** Publish the caller's live GPS for this adventure. */
  async postLocation(
    userId: string,
    bookingId: string,
    dto: LiveLocationBody,
  ) {
    const { booking, trip, isDriver } = await this.requireBookingParticipant(
      userId,
      bookingId,
    );
    const role = isDriver ? 'driver' : 'rider';

    let row = await this.liveLocations.findOne({
      where: { trip_id: trip.id, user_id: userId },
    });
    if (!row) {
      row = this.liveLocations.create({
        trip_id: trip.id,
        user_id: userId,
        role,
      });
    }
    row.role = role;
    row.latitude = dto.latitude;
    row.longitude = dto.longitude;
    row.heading = dto.heading ?? null;
    row.speed = dto.speed ?? null;
    await this.liveLocations.save(row);

    return { ok: true, updatedAt: row.updated_at.toISOString() };
  }

  /**
   * Live tracking payload for participants only — includes driver phone for
   * in-app call, and latest GPS for driver and rider.
   */
  async getTracking(userId: string, bookingId: string) {
    const { booking, trip } = await this.requireBookingParticipant(
      userId,
      bookingId,
    );
    const driver = await this.users.findOne({ where: { id: trip.driver_id } });
    const groupId = await this.findGroupIdForTrip(trip.id);
    const locations = await this.liveLocations.find({
      where: { trip_id: trip.id },
    });
    const driverLoc = locations.find((l) => l.user_id === trip.driver_id);
    const riderLoc = locations.find((l) => l.user_id === booking.rider_id);

    const toLoc = (l?: MobileLiveLocation | null) =>
      l
        ? {
            latitude: l.latitude,
            longitude: l.longitude,
            heading: l.heading,
            speed: l.speed,
            updatedAt: l.updated_at.toISOString(),
          }
        : null;

    return {
      booking: bookingToDto(
        booking,
        trip,
        driver?.name ?? 'Voyager',
        groupId,
      ),
      driver: {
        id: trip.driver_id,
        name: driver?.name ?? 'Voyager',
        phone: driver?.phone ?? null,
        car: trip.car ?? '',
        location: toLoc(driverLoc),
      },
      rider: {
        id: booking.rider_id,
        location: toLoc(riderLoc),
      },
      viewerRole:
        userId === trip.driver_id
          ? ('driver' as const)
          : ('rider' as const),
    };
  }

  /**
   * After payment, add the Voyager and paying Sailor to the Adventure group so
   * they can coordinate privately. One group per trip; riders join as they pay.
   */
  private async ensureGroupForBooking(
    tx: any,
    trip: MobileTrip,
    riderId: string,
  ): Promise<string> {
    const groupRepo = tx.getRepository(MobileTripGroup);
    const memberRepo = tx.getRepository(MobileTripGroupMember);
    const messageRepo = tx.getRepository(MobileTripGroupMessage);
    const userRepo = tx.getRepository(MobileUser);

    let group = await groupRepo.findOne({ where: { trip_id: trip.id } });
    const isNewGroup = !group;
    if (!group) {
      group = await groupRepo.save(
        groupRepo.create({ trip_id: trip.id, pickup_locked: false }),
      );
    }

    const ensureMember = async (
      userId: string,
      role: 'driver' | 'rider',
    ): Promise<boolean> => {
      const existing = await memberRepo.findOne({
        where: { group_id: group!.id, user_id: userId },
      });
      if (existing) return false;
      await memberRepo.save(
        memberRepo.create({
          group_id: group!.id,
          user_id: userId,
          role,
        }),
      );
      return true;
    };

    await ensureMember(trip.driver_id, 'driver');
    const riderAdded = await ensureMember(riderId, 'rider');

    if (isNewGroup) {
      await messageRepo.save(
        messageRepo.create({
          group_id: group.id,
          sender_id: null,
          text: 'Your Adventure group is ready! Use this chat to coordinate pickup after booking.',
          is_system: true,
        }),
      );
    } else if (riderAdded) {
      const rider = await userRepo.findOne({ where: { id: riderId } });
      const firstName = rider?.name?.split(' ')[0] ?? 'A sailor';
      await messageRepo.save(
        messageRepo.create({
          group_id: group.id,
          sender_id: null,
          text: `${firstName} joined the Adventure group after booking.`,
          is_system: true,
        }),
      );
    }

    return group.id;
  }
}
