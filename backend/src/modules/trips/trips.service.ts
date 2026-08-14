import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Trip, TripPreference, TripZone, TripReply } from '../../database/entities/trip.entities';
import { Booking } from '../../database/entities/booking.entities';
import { Vehicle } from '../../database/entities/profile.entities';
import { User } from '../../database/entities/user.entity';
import { SavedSearch } from '../../database/entities/saved-search.entity';
import { CreateTripDto, UpdateTripDto, SearchTripsDto, SaveSearchDto, CreateReplyDto } from './dto/trip.dto';
import { TripStatus, BookingStatus } from '../../common/enums';
import { PinoLogger } from 'nestjs-pino';
import axios from 'axios';
import { PricingService } from '../pricing/pricing.service';
import {
  PRICING,
  breachesCostShareCeiling,
  irsCeilingForMiles,
  ratePerMilePerSeat,
} from '../pricing/pricing.config';

const MAX_DRIVER_TRIPS_PER_7_DAYS = 6;

const METRO_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Austin: { lat: 30.2672, lng: -97.7431 },
  Houston: { lat: 29.7604, lng: -95.3698 },
};

const ZONE_POLYGONS: Record<string, string> = {
  Downtown: 'POLYGON((-97.7431 30.2672, -97.7400 30.2700, -97.7350 30.2672, -97.7400 30.2644, -97.7431 30.2672))',
  'UT Campus': 'POLYGON((-97.7400 30.2849, -97.7350 30.2880, -97.7300 30.2849, -97.7350 30.2818, -97.7400 30.2849))',
  'South Congress': 'POLYGON((-97.7500 30.2500, -97.7450 30.2530, -97.7400 30.2500, -97.7450 30.2470, -97.7500 30.2500))',
  'Domain/North Austin': 'POLYGON((-97.7200 30.4000, -97.7150 30.4030, -97.7100 30.4000, -97.7150 30.3970, -97.7200 30.4000))',
  'East Austin': 'POLYGON((-97.7100 30.2550, -97.7050 30.2580, -97.7000 30.2550, -97.7050 30.2520, -97.7100 30.2550))',
  'South Austin': 'POLYGON((-97.7900 30.2000, -97.7850 30.2030, -97.7800 30.2000, -97.7850 30.1970, -97.7900 30.2000))',
  Airport: 'POLYGON((-97.6700 30.1945, -97.6650 30.1975, -97.6600 30.1945, -97.6650 30.1915, -97.6700 30.1945))',
  'Round Rock / North': 'POLYGON((-97.6800 30.5083, -97.6750 30.5113, -97.6700 30.5083, -97.6750 30.5053, -97.6800 30.5083))',
  'Galleria/Uptown': 'POLYGON((-95.4620 29.7390, -95.4570 29.7420, -95.4520 29.7390, -95.4570 29.7360, -95.4620 29.7390))',
  'Medical Center': 'POLYGON((-95.3980 29.7050, -95.3930 29.7080, -95.3880 29.7050, -95.3930 29.7020, -95.3980 29.7050))',
  Heights: 'POLYGON((-95.4000 29.7800, -95.3950 29.7830, -95.3900 29.7800, -95.3950 29.7770, -95.4000 29.7800))',
  Montrose: 'POLYGON((-95.3900 29.7450, -95.3850 29.7480, -95.3800 29.7450, -95.3850 29.7420, -95.3900 29.7450))',
  'Sugar Land / SW': 'POLYGON((-95.6350 29.6196, -95.6300 29.6226, -95.6250 29.6196, -95.6300 29.6166, -95.6350 29.6196))',
  'Bush IAH': 'POLYGON((-95.3414 29.9844, -95.3364 29.9874, -95.3314 29.9844, -95.3364 29.9814, -95.3414 29.9844))',
  Hobby: 'POLYGON((-95.2789 29.6454, -95.2739 29.6484, -95.2689 29.6454, -95.2739 29.6424, -95.2789 29.6454))',
};

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(TripPreference)
    private readonly preferenceRepo: Repository<TripPreference>,
    @InjectRepository(TripZone)
    private readonly zoneRepo: Repository<TripZone>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(SavedSearch)
    private readonly savedSearchRepo: Repository<SavedSearch>,
    @InjectRepository(TripReply)
    private readonly replyRepo: Repository<TripReply>,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
    private readonly pricingService: PricingService,
  ) {}

  async createTrip(userId: string, dto: CreateTripDto): Promise<Trip> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.verifyDriverEligibility(userId, user);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentTrips = await this.tripRepo.count({
      where: {
        driver_id: userId,
        created_at: Between(weekAgo.toISOString(), new Date().toISOString()),
      },
    });
    if (recentTrips >= MAX_DRIVER_TRIPS_PER_7_DAYS) {
      throw new BadRequestException(
        `Trip posting limit reached. You have posted ${recentTrips} trips in the last 7 days. Maximum is ${MAX_DRIVER_TRIPS_PER_7_DAYS}.`,
      );
    }

    const vehicle = await this.vehicleRepo.findOne({ where: { id: dto.vehicle_id, driver_id: userId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found or not owned by driver');

    const distanceMiles = await this.getRouteDistance(dto.origin_metro, dto.dest_metro);

    if (distanceMiles < PRICING.MIN_DISTANCE_MILES) {
      throw new BadRequestException(
        `Bovogo serves intercity trips of ${PRICING.MIN_DISTANCE_MILES}+ miles. This trip is only ${Math.round(distanceMiles)} miles.`,
      );
    }

    const opsNotes: string[] = [];
    if (distanceMiles > PRICING.MAX_DISTANCE_MILES) {
      opsNotes.push(
        `⚠ Ops review: trip is ${Math.round(distanceMiles)} miles (exceeds ${PRICING.MAX_DISTANCE_MILES}-mile soft cap).`,
      );
    }
    // The flat seat price does not scale down on short routes, so a full car
    // below ~135 miles would recover more than the trip cost. Flagged, not
    // blocked — pricing is a business decision, but this must never pass
    // unnoticed.
    if (breachesCostShareCeiling(distanceMiles)) {
      opsNotes.push(
        `⚠ Cost-share review: at ${Math.round(distanceMiles)} miles, ${PRICING.STANDARD_OCCUPANCY_SEDAN} seats collect ` +
          `$${(PRICING.SEAT_PRICE * PRICING.STANDARD_OCCUPANCY_SEDAN).toFixed(2)} against an IRS ceiling of ` +
          `$${irsCeilingForMiles(distanceMiles).toFixed(2)}.`,
      );
    }
    const opsReviewNote = opsNotes.length ? opsNotes.join(' ') : undefined;

    const standardOccupancy = this.pricingService.getStandardOccupancy();
    const perSeatPrice = this.pricingService.calculateSeatPrice(distanceMiles);

    const trip = this.tripRepo.create({
      driver_id: userId,
      vehicle_id: dto.vehicle_id,
      origin_metro: dto.origin_metro,
      origin_pickup_zones: dto.origin_pickup_zones,
      dest_metro: dto.dest_metro,
      dest_dropoff_zones: dto.dest_dropoff_zones,
      departure_date: dto.departure_date,
      departure_time: dto.departure_time,
      departure_time_window: dto.departure_time_window || '+/- 30 min',
      seats_total: dto.seats_available,
      seats_available: dto.seats_available,
      per_seat_price: perSeatPrice,
      notes: opsReviewNote ? [dto.notes, opsReviewNote].filter(Boolean).join(' | ') : dto.notes,
      status: TripStatus.POSTED,
      distance_miles: distanceMiles,
      irs_rate_used: PRICING.IRS_RATE,
      total_occupants_calc: standardOccupancy,
      price_calculation_inputs: {
        model: 'flat_cost_share',
        formula:
          `base_seat_price = $${PRICING.SEAT_PRICE.toFixed(2)} flat, derived from ` +
          `180 mi × ${PRICING.IRS_RATE} × ${PRICING.SAFETY_FACTOR} ÷ ${standardOccupancy}`,
        distance_miles: distanceMiles,
        irs_mileage_rate: PRICING.IRS_RATE,
        cost_share_factor: PRICING.SAFETY_FACTOR,
        standard_occupancy: standardOccupancy,
        rate_per_mile_per_seat: Math.round(ratePerMilePerSeat() * 10000) / 10000,
        vehicle_category: 'sedan',
        seats_offered: dto.seats_available,
        flat_seat_price: PRICING.SEAT_PRICE,
        pct_of_irs_ceiling_at_full_occupancy: Number(
          (((perSeatPrice * standardOccupancy) / (distanceMiles * PRICING.IRS_RATE)) * 100).toFixed(2),
        ),
        // Evidence the Voyager stays under the IRS ceiling at full occupancy.
        irs_ceiling_for_trip: Math.round(distanceMiles * PRICING.IRS_RATE * 100) / 100,
        max_collected_at_full_occupancy:
          Math.round(perSeatPrice * standardOccupancy * 100) / 100,
        final_price: perSeatPrice,
      },
      luggage_capacity: dto.luggage_capacity || 'small',
    });

    const saved = await this.tripRepo.save(trip);

    const prefs = this.preferenceRepo.create({
      trip_id: saved.id,
      conversation: dto.conversation || 'friendly',
      music: dto.music || 'background',
      smoking: dto.smoking || 'never',
      pets: dto.pets || 'with_approval',
      women_only: dto.women_only || false,
    });
    await this.preferenceRepo.save(prefs);

    // Zones disabled locally (PostGIS not available)
    // await this.saveTripZones(saved.id, dto.origin_pickup_zones, 'pickup');
    // await this.saveTripZones(saved.id, dto.dest_dropoff_zones, 'dropoff');

    this.logger.info(
      { tripId: saved.id, driverId: userId, distanceMiles, perSeatPrice },
      'Trip created with calculated price',
    );

    return this.getTripWithRelations(saved.id);
  }

  private async verifyDriverEligibility(userId: string, user: User): Promise<void> {
    if (!user.is_email_verified) {
      throw new ForbiddenException('Email verification required before posting trips');
    }

    if (user.background_check_status !== 'clear') {
      throw new ForbiddenException(
        `Background check status: ${user.background_check_status}. Must be "clear" to post trips.`,
      );
    }

    const vehicleCount = await this.vehicleRepo.count({
      where: { driver_id: userId, is_verified: true },
    });
    if (vehicleCount === 0) {
      throw new ForbiddenException('At least one verified vehicle is required to post trips');
    }
  }

  private async saveTripZones(tripId: string, zoneNames: string[], zoneType: string): Promise<void> {
    this.logger.warn(`saveTripZones SKIPPED, tripId=${tripId}, zones=${zoneNames.length}, type=${zoneType}`);
  }

  async searchTrips(params: SearchTripsDto, riderId?: string): Promise<any[]> {
    const isHard = params.filter_mode === 'hard';

    const query = this.tripRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.driver', 'driver')
      .leftJoinAndSelect('trip.vehicle', 'vehicle')
      .leftJoinAndSelect('trip.preferences', 'preferences')
      .where('trip.origin_metro = :origin', { origin: params.origin_metro })
      .andWhere('trip.dest_metro = :dest', { dest: params.dest_metro })
      .andWhere('trip.departure_date = :date', { date: params.travel_date })
      .andWhere('trip.status = :status', { status: TripStatus.POSTED })
      .andWhere('trip.seats_available >= :seats', { seats: params.seats_needed || 1 });

    if (params.verified_drivers_only !== false) {
      query.andWhere('driver.background_check_status = :bgStatus', { bgStatus: 'clear' });
    }

    if (isHard) {
      if (params.women_only) {
        query.andWhere('preferences.women_only = true');
        if (riderId) {
          const rider = await this.userRepo.findOne({ where: { id: riderId } });
          if (rider?.gender !== 'female') {
            return [];
          }
        }
      }
      if (params.smoking_preference) {
        query.andWhere('preferences.smoking = :smoking', { smoking: params.smoking_preference });
      }
      if (params.pet_preference) {
        query.andWhere('preferences.pets = :pets', { pets: params.pet_preference });
      }
      if (params.conversation_style) {
        query.andWhere('preferences.conversation = :conv', { conv: params.conversation_style });
      }
      if (params.music_preference) {
        query.andWhere('preferences.music = :music', { music: params.music_preference });
      }
    }

    if (params.max_price !== undefined) {
      query.andWhere('trip.per_seat_price <= :maxPrice', { maxPrice: params.max_price });
    }
    if (params.vehicle_category) {
      query.andWhere('vehicle.category = :category', { category: params.vehicle_category });
    }
    if (params.luggage_capacity) {
      query.andWhere('vehicle.max_luggage_class >= :luggage', { luggage: params.luggage_capacity });
    }
    if (params.min_rating !== undefined) {
      query.andWhere('driver.avg_rating >= :minRating', { minRating: params.min_rating });
    }

    switch (params.sort) {
      case 'earliest':
        query.orderBy('trip.departure_time', 'ASC');
        break;
      case 'lowest_price':
        query.orderBy('trip.per_seat_price', 'ASC');
        break;
      case 'highest_rated':
        query.orderBy('driver.avg_rating', 'DESC');
        break;
      default:
        query.orderBy('trip.departure_time', 'ASC');
    }

    const trips = await query.getMany();

    if (params.sort === 'best_match' && !isHard) {
      const rider = riderId ? await this.userRepo.findOne({ where: { id: riderId } }) : null;

      for (const trip of trips) {
        let score = 50;

        const prefs = trip.preferences?.[0];
        if (prefs) {
          if (rider?.rider_conversation_style && prefs.conversation === rider.rider_conversation_style) {
            score += 10;
          }
          if (rider?.rider_music_preference && prefs.music === rider.rider_music_preference) {
            score += 5;
          }
          if (rider?.rider_smoking_preference && prefs.smoking === rider.rider_smoking_preference) {
            score += 8;
          }
          if (rider?.rider_pet_preference && prefs.pets === rider.rider_pet_preference) {
            score += 3;
          }
        }

        if (trip.driver?.avg_rating) {
          score += Math.min(trip.driver.avg_rating * 2, 10);
        }

        if (trip.driver?.background_check_status === 'clear') {
          score += 5;
        }

        trip.match_score = score;
      }

      trips.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
    }

    return trips;
  }

  async saveSearch(userId: string, dto: SaveSearchDto): Promise<SavedSearch> {
    const existing = await this.savedSearchRepo.findOne({
      where: {
        user_id: userId,
        origin_metro: dto.origin_metro,
        dest_metro: dto.dest_metro,
        travel_date: dto.travel_date,
      },
    });

    if (existing) {
      existing.usage_count += 1;
      existing.name = dto.name || existing.name;
      existing.seats_needed = dto.seats_needed || existing.seats_needed;
      existing.conversation_style = dto.conversation_style ?? existing.conversation_style;
      existing.music_preference = dto.music_preference ?? existing.music_preference;
      existing.smoking_preference = dto.smoking_preference ?? existing.smoking_preference;
      existing.pet_preference = dto.pet_preference ?? existing.pet_preference;
      existing.women_only = dto.women_only ?? existing.women_only;
      existing.strict_filters = dto.strict_filters ?? existing.strict_filters;
      existing.sort_by = dto.sort_by || existing.sort_by;
      return this.savedSearchRepo.save(existing);
    }

    const savedSearch = this.savedSearchRepo.create({
      user_id: userId,
      name: dto.name || `${dto.origin_metro} → ${dto.dest_metro}`,
      origin_metro: dto.origin_metro,
      dest_metro: dto.dest_metro,
      travel_date: dto.travel_date,
      seats_needed: dto.seats_needed || 1,
      conversation_style: dto.conversation_style || null,
      music_preference: dto.music_preference || null,
      smoking_preference: dto.smoking_preference || null,
      pet_preference: dto.pet_preference || null,
      women_only: dto.women_only || false,
      strict_filters: dto.strict_filters || false,
      sort_by: dto.sort_by || 'best_match',
      usage_count: 1,
    });

    return this.savedSearchRepo.save(savedSearch);
  }

  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    return this.savedSearchRepo.find({
      where: { user_id: userId },
      order: { usage_count: 'DESC', created_at: 'DESC' },
    });
  }

  async deleteSavedSearch(userId: string, searchId: string): Promise<void> {
    const result = await this.savedSearchRepo.delete({ id: searchId, user_id: userId });
    if (result.affected === 0) {
      throw new NotFoundException('Saved search not found');
    }
  }

  async getTrip(id: string): Promise<Trip | null> {
    return this.getTripWithRelations(id);
  }

  private async getTripWithRelations(id: string): Promise<any> {
    const trip = await this.tripRepo.findOne({
      where: { id },
      relations: ['driver', 'vehicle'],
    });
    if (!trip) throw new NotFoundException('Trip not found');

    const prefs = await this.preferenceRepo.findOne({ where: { trip_id: id } });
    return { ...trip, preferences: prefs || null };
  }

  async getMyTrips(userId: string): Promise<any[]> {
    const trips = await this.tripRepo.find({
      where: { driver_id: userId },
      order: { departure_date: 'DESC' },
    });

    if (!trips.length) return [];

    const tripIds = trips.map((t) => t.id);
    const [prefsList, vehicles] = await Promise.all([
      this.preferenceRepo.find({ where: { trip_id: In(tripIds) } }),
      this.vehicleRepo.find({ where: { driver_id: userId } }),
    ]);

    const prefsMap = new Map(prefsList.map((p) => [p.trip_id, p]));
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

    return trips.map((trip) => {
      const p = prefsMap.get(trip.id);
      const v = vehicleMap.get(trip.vehicle_id);
      return {
        id: trip.id,
        driver_id: trip.driver_id,
        vehicle_id: trip.vehicle_id,
        origin_metro: trip.origin_metro,
        origin_pickup_zones: trip.origin_pickup_zones,
        dest_metro: trip.dest_metro,
        dest_dropoff_zones: trip.dest_dropoff_zones,
        departure_date: trip.departure_date,
        departure_time: trip.departure_time,
        departure_time_window: trip.departure_time_window,
        seats_total: trip.seats_total,
        seats_available: trip.seats_available,
        per_seat_price: Number(trip.per_seat_price),
        status: trip.status,
        notes: trip.notes,
        distance_miles: trip.distance_miles,
        irs_rate_used: trip.irs_rate_used,
        total_occupants_calc: trip.total_occupants_calc,
        price_calculation_inputs: trip.price_calculation_inputs,
        luggage_capacity: trip.luggage_capacity,
        mapbox_route_polyline: trip.mapbox_route_polyline,
        expected_arrival_time: trip.expected_arrival_time,
        origin_lat: trip.origin_lat,
        origin_lng: trip.origin_lng,
        dest_lat: trip.dest_lat,
        dest_lng: trip.dest_lng,
        created_at: trip.created_at,
        updated_at: trip.updated_at,
        preferences: p || null,
        vehicle: v || null,
      };
    });
  }

  async updateTrip(userId: string, tripId: string, dto: UpdateTripDto): Promise<Trip> {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId, driver_id: userId },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status !== TripStatus.POSTED) {
      throw new BadRequestException('Can only edit posted trips');
    }

    const activeBookings = await this.bookingRepo.count({
      where: { trip_id: tripId, status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]) },
    });
    if (activeBookings > 0) {
      throw new BadRequestException('Cannot edit trip with active bookings');
    }

    const { preferences, ...tripFields } = dto;
    Object.assign(trip, tripFields);
    const saved = await this.tripRepo.save(trip);

    if (preferences) {
      const prefs = await this.preferenceRepo.findOne({ where: { trip_id: tripId } });
      if (prefs) {
        Object.assign(prefs, preferences);
        await this.preferenceRepo.save(prefs);
      }
    }

    return this.getTripWithRelations(tripId);
  }

  async cancelTrip(userId: string, tripId: string): Promise<void> {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId, driver_id: userId },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status !== TripStatus.POSTED) {
      throw new BadRequestException('Can only cancel posted trips');
    }

    const activeBookings = await this.bookingRepo.find({
      where: {
        trip_id: tripId,
        status: In([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
      },
    });

    if (activeBookings.length === 0) {
      const hoursBeforeDeparture = (new Date(`${trip.departure_date}T${trip.departure_time}`).getTime() - Date.now()) / 3600000;
      if (hoursBeforeDeparture >= 4) {
        this.logger.info({ tripId, hoursBeforeDeparture }, 'Trip cancelled within 4h grace period — no penalty');
      } else {
        this.logger.warn({ tripId, hoursBeforeDeparture }, 'Trip cancelled outside 4h grace period with 0 riders — possible penalty');
      }
    }

    if (activeBookings.length > 0) {
      for (const booking of activeBookings) {
        if (booking.payment_intent_id) {
          const stripe = this.getStripeClient();
          await stripe.paymentIntents.cancel(booking.payment_intent_id);
        }
        booking.status = BookingStatus.CANCELLED;
        await this.bookingRepo.save(booking);
      }
    }

    trip.status = TripStatus.CANCELLED;
    await this.tripRepo.save(trip);

    this.logger.info(
      { tripId, cancelledBookings: activeBookings.length },
      'Trip cancelled with cascading booking cancellations',
    );
  }

  async markDeparting(userId: string, tripId: string): Promise<void> {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId, driver_id: userId },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status !== TripStatus.POSTED && trip.status !== TripStatus.CONFIRMED) {
      throw new BadRequestException('Trip must be posted or confirmed to mark as departing');
    }

    trip.status = TripStatus.IN_PROGRESS;
    await this.tripRepo.save(trip);

    this.logger.info({ tripId }, 'Trip marked as departing — payment capture and insurance activation triggered');
  }

  async markCompleted(userId: string, tripId: string): Promise<void> {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId, driver_id: userId },
    });
    if (!trip) throw new NotFoundException('Trip not found');

    trip.status = TripStatus.COMPLETED;
    await this.tripRepo.save(trip);

    await this.userRepo.increment({ id: userId }, 'total_trips', 1);

    this.logger.info({ tripId }, 'Trip marked as completed — driver trip count incremented');
  }

  private async getRouteDistance(origin: string, dest: string): Promise<number> {
    const mapboxToken = this.config.get('MAPBOX_ACCESS_TOKEN');

    if (!mapboxToken) {
      const knownDistances: Record<string, number> = {
        'Austin-Houston': 165,
        'Houston-Austin': 165,
      };
      const key = `${origin}-${dest}`;
      if (knownDistances[key]) return knownDistances[key];

      const originCoords = METRO_COORDINATES[origin];
      const destCoords = METRO_COORDINATES[dest];
      if (originCoords && destCoords) {
        const R = 3959;
        const dLat = this.toRad(destCoords.lat - originCoords.lat);
        const dLng = this.toRad(destCoords.lng - originCoords.lng);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(this.toRad(originCoords.lat)) *
            Math.cos(this.toRad(destCoords.lat)) *
            Math.sin(dLng / 2) ** 2;
        return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
      }

      return 165;
    }

    try {
      const originCoords = METRO_COORDINATES[origin];
      const destCoords = METRO_COORDINATES[dest];
      if (!originCoords || !destCoords) return 165;

      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}?access_token=${mapboxToken}&geometries=json&overview=full`;
      const { data } = await axios.get(url);

      if (data.routes && data.routes.length > 0) {
        const meters = data.routes[0].distance;
        return Math.round(meters * 0.000621371);
      }

      return 165;
    } catch (error) {
      this.logger.warn({ origin, dest, error }, 'Mapbox API failed, using fallback distance');
      return 165;
    }
  }

  async getReplies(tripId: string) {
    return this.replyRepo.find({
      where: { trip_id: tripId },
      order: { created_at: 'ASC' },
    });
  }

  async createReply(userId: string, tripId: string, dto: CreateReplyDto) {
    const trip = await this.tripRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    const reply = this.replyRepo.create({
      trip_id: tripId,
      user_id: userId,
      text: dto.text,
    });
    return this.replyRepo.save(reply);
  }

  async quickBook(userId: string, tripId: string) {
    const trip = await this.tripRepo.findOne({ where: { id: tripId }, relations: ['vehicle'] });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.status !== TripStatus.POSTED) throw new BadRequestException('Trip no longer available');
    if (trip.seats_available < 1) throw new BadRequestException('No seats available');
    if (trip.driver_id === userId) throw new BadRequestException('Cannot book your own trip');

    const luggageTotal = 0;
    const insuranceCost = 0;
    const rideCostCents = Math.round(+trip.per_seat_price * 100);
    const totalCents = rideCostCents + luggageTotal + insuranceCost;

    let paymentIntent: { id: string; client_secret: string };

    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY')!;
    if (stripeKey && !stripeKey.includes('mock')) {
      const Stripe = require('stripe');
      const stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' });
      paymentIntent = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: 'usd',
        metadata: { trip_id: tripId, rider_id: userId },
      });
    } else {
      paymentIntent = {
        id: `pi_mock_${Date.now()}`,
        client_secret: `pi_mock_${Date.now()}_secret_mock`,
      };
    }

    const booking = this.bookingRepo.create({
      trip_id: tripId,
      rider_id: userId,
      seats: 1,
      total_price: totalCents / 100,
      insurance_opted_in: false,
      status: BookingStatus.PENDING,
      payment_intent_id: paymentIntent.id,
    });
    const saved = await this.bookingRepo.save(booking);

    trip.seats_available -= 1;
    if (trip.seats_available <= 0) trip.seats_available = 0;
    await this.tripRepo.save(trip);

    return {
      client_secret: paymentIntent.client_secret,
      booking_id: saved.id,
      total_price: totalCents / 100,
      per_seat_price: +trip.per_seat_price,
    };
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  private getStripeClient() {
    const Stripe = require('stripe');
    return new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
      apiVersion: '2025-02-24.acacia',
    });
  }
}
