import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Trip, TripPreference } from '../../database/entities/trip.entities';
import { User } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entities';
import { TripStatus } from '../../common/enums';

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(TripPreference)
    private readonly preferenceRepo: Repository<TripPreference>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async getDriverPosts(): Promise<any[]> {
    const trips = await this.tripRepo.find({
      where: { status: TripStatus.POSTED, seats_available: MoreThan(0) } as any,
      relations: ['driver'],
      order: { created_at: 'DESC' },
      take: 50,
    });

    return Promise.all(
      trips.map(async (trip) => {
        const driver = trip.driver;
        return {
          id: trip.id,
          driverId: trip.driver_id,
          driverName: driver?.name || 'Unknown Driver',
          driverAvatar: null,
          driverRating: Number(driver?.avg_rating) || 5.0,
          tripCount: Number(driver?.total_trips) || 0,
          topDriver: (Number(driver?.avg_rating) || 0) >= 4.8,
          body: trip.notes || `Trip from ${trip.origin_metro} to ${trip.dest_metro}`,
          originMetro: trip.origin_metro,
          destMetro: trip.dest_metro,
          departureDate: trip.departure_date,
          departureTime: trip.departure_time,
          seatsRemaining: trip.seats_available,
          pricePerSeat: Number(trip.per_seat_price),
          replyCount: 0,
          createdAt: trip.created_at || new Date().toISOString(),
        };
      }),
    );
  }

  async getDriverPost(id: string): Promise<any | null> {
    const trip = await this.tripRepo.findOne({
      where: { id } as any,
      relations: ['driver', 'vehicle'],
    });
    if (!trip) throw new NotFoundException('Post not found');

    const driver = trip.driver;
    const prefs = await this.preferenceRepo.findOne({ where: { trip_id: id } });
    const bookingCount = await this.bookingRepo.count({ where: { trip_id: id } });

    const prefList: string[] = [];
    if (prefs) {
      if (prefs.conversation) prefList.push(prefs.conversation);
      if (prefs.music) prefList.push(prefs.music);
      if (prefs.smoking) prefList.push(`No ${prefs.smoking}`);
      if (prefs.women_only) prefList.push('Women Only');
    }

    return {
      id: trip.id,
      driverName: driver?.name || 'Unknown Driver',
      driverAvatar: null,
      driverRating: Number(driver?.avg_rating) || 5.0,
      tripCount: Number(driver?.total_trips) || 0,
      topDriver: (Number(driver?.avg_rating) || 0) >= 4.8,
      body: trip.notes || `Trip from ${trip.origin_metro} to ${trip.dest_metro}`,
      originMetro: trip.origin_metro,
      destMetro: trip.dest_metro,
      departureDate: trip.departure_date,
      departureTime: trip.departure_time,
      seatsRemaining: trip.seats_available,
      pricePerSeat: Number(trip.per_seat_price),
      preferences: prefList,
      replies: [],
      active: ['posted', 'booked', 'confirmed', 'en_route', 'in_progress'].includes(trip.status),
    };
  }
}
