import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DriverTrip } from '../../database/entities/driver-trip.entity';
import { Booking } from '../../database/entities/booking.entities';
import { Trip } from '../../database/entities/trip.entities';
import { BookingStatus } from '../../common/enums';
import { PinoLogger } from 'nestjs-pino';

const PLATFORM_FEE_RATE = 0.1;

@Injectable()
export class DriverTripsService {
  constructor(
    @InjectRepository(DriverTrip)
    private readonly driverTripRepo: Repository<DriverTrip>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    private readonly logger: PinoLogger,
  ) {}

  async recordCompletedTrip(bookingId: string): Promise<DriverTrip> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new Error(
        'Booking must be completed before recording a driver trip',
      );
    }

    const trip = booking.trip;
    if (!trip) throw new NotFoundException('Trip not found');

    const grossAmount = Number(booking.total_price);
    const platformFee = parseFloat(
      (grossAmount * PLATFORM_FEE_RATE).toFixed(2),
    );
    const netAmount = parseFloat((grossAmount - platformFee).toFixed(2));

    const driverTrip = this.driverTripRepo.create({
      id: uuidv4().replace(/-/g, '').slice(0, 32),
      driver_id: trip.driver_id,
      from_city: trip.origin_metro,
      to_city: trip.dest_metro,
      miles: trip.distance_miles ? Number(trip.distance_miles) : 0,
      seats_booked: booking.seats,
      gross_amount: grossAmount,
      platform_fee: platformFee,
      net_amount: netAmount,
      completed_at: new Date(),
    });

    const saved = await this.driverTripRepo.save(driverTrip);
    this.logger.info(
      {
        bookingId,
        driverId: trip.driver_id,
        grossAmount,
        platformFee,
        netAmount,
      },
      'Driver trip recorded from completed booking',
    );
    return saved;
  }

  async getDriverTrips(
    driverId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ trips: DriverTrip[]; total: number }> {
    const [trips, total] = await this.driverTripRepo.findAndCount({
      where: { driver_id: driverId },
      order: { completed_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { trips, total };
  }

  async getDriverEarnings(
    driverId: string,
  ): Promise<{ gross: number; fees: number; net: number }> {
    const result = await this.driverTripRepo
      .createQueryBuilder('dt')
      .select('COALESCE(SUM(dt.gross_amount), 0)', 'gross')
      .addSelect('COALESCE(SUM(dt.platform_fee), 0)', 'fees')
      .addSelect('COALESCE(SUM(dt.net_amount), 0)', 'net')
      .where('dt.driver_id = :driverId', { driverId })
      .getRawOne();

    return {
      gross: parseFloat(result.gross),
      fees: parseFloat(result.fees),
      net: parseFloat(result.net),
    };
  }

  async getDriverEarningsByPeriod(
    driverId: string,
    startDate: string,
    endDate: string,
  ): Promise<{
    trips: DriverTrip[];
    gross: number;
    fees: number;
    net: number;
  }> {
    const trips = await this.driverTripRepo.find({
      where: {
        driver_id: driverId,
        completed_at: Between(new Date(startDate), new Date(endDate)),
      },
      order: { completed_at: 'ASC' },
    });

    const gross = trips.reduce((sum, t) => sum + Number(t.gross_amount), 0);
    const fees = trips.reduce((sum, t) => sum + Number(t.platform_fee), 0);
    const net = trips.reduce((sum, t) => sum + Number(t.net_amount), 0);

    return {
      trips,
      gross: parseFloat(gross.toFixed(2)),
      fees: parseFloat(fees.toFixed(2)),
      net: parseFloat(net.toFixed(2)),
    };
  }
}
