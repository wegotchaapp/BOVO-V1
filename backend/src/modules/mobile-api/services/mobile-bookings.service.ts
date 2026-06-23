import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  MobileBooking,
  MobileTrip,
  MobileTripGroup,
  MobileTripGroupMember,
  MobileTripGroupMessage,
  MobileUser,
} from '../entities/mobile.entities';
import { CreateBookingBody } from '../dto/mobile.dto';
import { bookingToDto } from '../mobile.mappers';

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
    private readonly dataSource: DataSource,
  ) {}

  async create(riderId: string, dto: CreateBookingBody) {
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
      if (trip.status !== 'active') {
        throw new BadRequestException('This trip is no longer available.');
      }
      if (trip.driver_id === riderId) {
        throw new BadRequestException("You can't book a seat on your own trip.");
      }
      if (trip.departure_at.getTime() < Date.now() - 60_000) {
        throw new BadRequestException('This trip has already departed.');
      }
      if (trip.seats_available < dto.seats) {
        throw new BadRequestException(
          `Only ${trip.seats_available} seat${
            trip.seats_available === 1 ? '' : 's'
          } left on this trip.`,
        );
      }

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
        }),
      );

      const driver = await userRepo.findOne({ where: { id: trip.driver_id } });

      await this.ensureGroupIfFull(tx, trip);

      return {
        booking: bookingToDto(inserted, trip, driver?.name ?? 'Voyager'),
      };
    });
  }

  async mine(riderId: string) {
    const rows = await this.bookings.find({
      where: { rider_id: riderId },
      order: { created_at: 'DESC' },
    });
    const result = [];
    for (const b of rows) {
      const trip = await this.trips.findOne({ where: { id: b.trip_id } });
      if (!trip) continue;
      const driver = await this.users.findOne({ where: { id: trip.driver_id } });
      result.push(bookingToDto(b, trip, driver?.name ?? 'Voyager'));
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
    return { booking: bookingToDto(booking, trip, driver?.name ?? 'Voyager') };
  }

  /**
   * When a booking fills the last seat, create the trip group (if absent) and
   * enroll the driver plus every confirmed rider. No-ops while seats remain.
   */
  private async ensureGroupIfFull(tx: any, trip: MobileTrip) {
    if (trip.seats_available > 0) return;
    const groupRepo = tx.getRepository(MobileTripGroup);
    const memberRepo = tx.getRepository(MobileTripGroupMember);
    const messageRepo = tx.getRepository(MobileTripGroupMessage);
    const bookingRepo = tx.getRepository(MobileBooking);

    const existing = await groupRepo.findOne({ where: { trip_id: trip.id } });
    if (existing) return;

    const group = await groupRepo.save(
      groupRepo.create({ trip_id: trip.id, pickup_locked: false }),
    );

    await memberRepo.save(
      memberRepo.create({
        group_id: group.id,
        user_id: trip.driver_id,
        role: 'driver',
      }),
    );

    const confirmed = await bookingRepo.find({
      where: { trip_id: trip.id, status: 'confirmed' },
    });
    const riderIds = [...new Set(confirmed.map((b: MobileBooking) => b.rider_id))];
    for (const riderId of riderIds) {
      await memberRepo.save(
        memberRepo.create({
          group_id: group.id,
          user_id: riderId,
          role: 'rider',
        }),
      );
    }

    await messageRepo.save(
      messageRepo.create({
        group_id: group.id,
        sender_id: null,
        text: 'Your Adventure is full! Use this group to coordinate pickup.',
        is_system: true,
      }),
    );
  }
}
