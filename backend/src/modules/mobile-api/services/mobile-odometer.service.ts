import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import {
  MobileBooking,
  MobileDriverTrip,
  MobileOdometerReading,
  MobileTrip,
  MobileUser,
} from '../entities/mobile.entities';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const ODOMETER_BUCKET = 'bovogo-odometer-photos';

const ALLOWED_IMAGE_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
};

/**
 * Guard rails on the typed reading. These catch fat-fingered entries (a missing
 * or extra digit) without getting in the way of a genuine long haul.
 */
const MAX_ODOMETER_MILES = 2_000_000;
const MAX_SINGLE_LEG_MILES = 1_000;

export interface UploadedPhotoFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface RecordReadingInput {
  bookingId: string;
  kind: 'pickup' | 'dropoff';
  miles: number;
  latitude?: number;
  longitude?: number;
}

@Injectable()
export class MobileOdometerService {
  private readonly s3: S3Client;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(MobileTrip)
    private readonly trips: Repository<MobileTrip>,
    @InjectRepository(MobileBooking)
    private readonly bookings: Repository<MobileBooking>,
    @InjectRepository(MobileOdometerReading)
    private readonly readings: Repository<MobileOdometerReading>,
    @InjectRepository(MobileUser)
    private readonly users: Repository<MobileUser>,
    @InjectRepository(MobileDriverTrip)
    private readonly driverTrips: Repository<MobileDriverTrip>,
  ) {
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    this.s3 = new S3Client({
      region: this.config.get<string>('AWS_REGION'),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  /**
   * Everyone booked on this adventure, with where each one is in the
   * pickup → on board → dropped off cycle. This is what the Voyager works
   * through during the drive.
   */
  async manifest(voyagerId: string, tripId: string) {
    const trip = await this.requireOwnTrip(voyagerId, tripId);

    const rows = await this.bookings.find({
      where: { trip_id: tripId, status: In(['confirmed', 'completed']) },
      order: { created_at: 'ASC' },
    });

    const sailorIds = [...new Set(rows.map((b) => b.rider_id))];
    const sailors = sailorIds.length
      ? await this.users.find({ where: { id: In(sailorIds) } })
      : [];
    const sailorById = new Map(sailors.map((s) => [s.id, s]));

    const entries = rows.map((b) => {
      const sailor = sailorById.get(b.rider_id);
      return {
        bookingId: b.id,
        sailorId: b.rider_id,
        sailorName: sailor?.name ?? 'Sailor',
        sailorPhotoUrl: sailor?.photo_url ?? null,
        seats: b.seats,
        status: bookingLegStatus(b),
        pickupMiles: b.pickup_miles,
        dropoffMiles: b.dropoff_miles,
        milesTravelled: b.miles_travelled,
        pickedUpAt: b.picked_up_at?.toISOString() ?? null,
        droppedOffAt: b.dropped_off_at?.toISOString() ?? null,
      };
    });

    return {
      tripId: trip.id,
      tripStatus: trip.status,
      startVideoRecorded: !!trip.start_video_url,
      lastOdometerMiles: await this.highestReadingFor(tripId),
      entries,
    };
  }

  /**
   * Records one photographed odometer reading. A dropoff closes the Sailor's
   * leg and writes their exact mileage; the final dropoff completes the
   * adventure and writes the Voyager's savings record.
   */
  async record(
    voyagerId: string,
    tripId: string,
    input: RecordReadingInput,
    photo: UploadedPhotoFile | undefined,
  ) {
    const trip = await this.requireOwnTrip(voyagerId, tripId);

    if (trip.status === 'cancelled') {
      throw new BadRequestException('This adventure was cancelled.');
    }
    if (trip.status === 'completed') {
      throw new BadRequestException('This adventure is already complete.');
    }
    // The 360° car video gates the whole trip, so it also gates odometer entry.
    if (!trip.start_video_url) {
      throw new BadRequestException(
        'Record the video of your car before logging odometer readings.',
      );
    }
    if (trip.status !== 'in_progress') {
      throw new BadRequestException(
        'Start the adventure before logging odometer readings.',
      );
    }

    if (input.kind !== 'pickup' && input.kind !== 'dropoff') {
      throw new BadRequestException('Reading must be a pickup or a dropoff.');
    }

    const miles = Number(input.miles);
    if (!Number.isFinite(miles) || !Number.isInteger(miles) || miles < 0) {
      throw new BadRequestException(
        'Enter the odometer reading as a whole number of miles.',
      );
    }
    if (miles > MAX_ODOMETER_MILES) {
      throw new BadRequestException(
        'That odometer reading looks too high — please re-check it.',
      );
    }

    if (!photo || !photo.buffer?.length) {
      throw new BadRequestException('A photo of the odometer is required.');
    }
    const ext = ALLOWED_IMAGE_MIME[photo.mimetype];
    if (!ext) {
      throw new BadRequestException(
        'Unsupported image format. Please take the photo with your camera.',
      );
    }

    const booking = await this.bookings.findOne({
      where: { id: input.bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.trip_id !== tripId) {
      throw new BadRequestException('That Sailor is not on this adventure.');
    }
    if (booking.status !== 'confirmed' && booking.status !== 'completed') {
      throw new BadRequestException(
        'That booking is not confirmed, so it cannot be logged.',
      );
    }

    // Ordering rules per Sailor.
    if (input.kind === 'pickup' && booking.pickup_miles != null) {
      throw new BadRequestException('This Sailor has already been picked up.');
    }
    if (input.kind === 'dropoff') {
      if (booking.pickup_miles == null) {
        throw new BadRequestException(
          'Record this Sailor’s pickup before their dropoff.',
        );
      }
      if (booking.dropoff_miles != null) {
        throw new BadRequestException(
          'This Sailor has already been dropped off.',
        );
      }
      if (miles < booking.pickup_miles) {
        throw new BadRequestException(
          `Dropoff reading (${miles}) cannot be lower than the pickup reading (${booking.pickup_miles}).`,
        );
      }
      if (miles - booking.pickup_miles > MAX_SINGLE_LEG_MILES) {
        throw new BadRequestException(
          'That would record an implausibly long leg — please re-check the reading.',
        );
      }
    }

    // An odometer only ever counts up, so no reading may go below the highest
    // already logged on this trip.
    const highest = await this.highestReadingFor(tripId);
    if (highest != null && miles < highest) {
      throw new BadRequestException(
        `Reading (${miles}) is lower than an earlier reading on this adventure (${highest}). Odometers only go up.`,
      );
    }

    const key = `trips/${tripId}/${input.kind}-${booking.id}-${randomUUID()}.${ext}`;
    await this.storePhoto(key, photo.buffer, photo.mimetype);
    const appUrl = this.config.get('APP_URL') || 'http://localhost:3000';
    const photoUrl = `${appUrl}/uploads/${ODOMETER_BUCKET}/${key}`;

    const now = new Date();
    await this.readings.save(
      this.readings.create({
        trip_id: tripId,
        booking_id: booking.id,
        sailor_id: booking.rider_id,
        voyager_id: voyagerId,
        kind: input.kind,
        miles,
        photo_url: photoUrl,
        latitude: input.latitude != null ? String(input.latitude) : null,
        longitude: input.longitude != null ? String(input.longitude) : null,
        recorded_at: now,
      }),
    );

    if (input.kind === 'pickup') {
      booking.pickup_miles = miles;
      booking.picked_up_at = now;
    } else {
      booking.dropoff_miles = miles;
      booking.dropped_off_at = now;
      booking.miles_travelled = miles - (booking.pickup_miles ?? miles);
      booking.status = 'completed';
      booking.completed_at = now;
    }
    await this.bookings.save(booking);

    const completion = await this.maybeCompleteTrip(trip);

    return {
      ok: true,
      reading: {
        bookingId: booking.id,
        kind: input.kind,
        miles,
        photoUrl,
        recordedAt: now.toISOString(),
      },
      milesTravelled: booking.miles_travelled,
      tripCompleted: completion.completed,
      manifest: await this.manifest(voyagerId, tripId),
    };
  }

  /** Highest odometer figure logged so far on a trip, or null if none yet. */
  private async highestReadingFor(tripId: string): Promise<number | null> {
    const row = await this.readings.findOne({
      where: { trip_id: tripId },
      order: { miles: 'DESC' },
    });
    return row ? row.miles : null;
  }

  /**
   * Once every Sailor has been dropped off, the adventure is finished. This is
   * also the only place a MobileDriverTrip row is written, so the Voyager's
   * savings record is built from real odometer miles rather than an estimate.
   */
  private async maybeCompleteTrip(
    trip: MobileTrip,
  ): Promise<{ completed: boolean }> {
    const active = await this.bookings.find({
      where: { trip_id: trip.id, status: In(['confirmed', 'completed']) },
    });
    if (active.length === 0) return { completed: false };

    const allDroppedOff = active.every((b) => b.dropoff_miles != null);
    if (!allDroppedOff) return { completed: false };

    const now = new Date();

    // Distance the vehicle actually covered carrying Sailors: first pickup to
    // last dropoff. Per-Sailor legs overlap on a shared route, so summing them
    // would multiply-count the same road.
    const pickups = active.map((b) => b.pickup_miles!).filter((m) => m != null);
    const dropoffs = active
      .map((b) => b.dropoff_miles!)
      .filter((m) => m != null);
    const tripMiles = pickups.length
      ? Math.max(...dropoffs) - Math.min(...pickups)
      : 0;

    const seatsBooked = active.reduce((sum, b) => sum + b.seats, 0);
    // The Voyager receives the seat cost-share plus the luggage surcharge in
    // full. The platform fee and insurance premiums were charged to the Sailor
    // on top and belong to Bovogo/the MGA, so they never enter this figure.
    const gross = active.reduce(
      (sum, b) =>
        sum +
        Number(b.price_per_seat) * b.seats +
        Number(b.luggage_surcharge ?? 0),
      0,
    );
    const fees = active.reduce((sum, b) => sum + Number(b.service_fee), 0);

    await this.driverTrips.save(
      this.driverTrips.create({
        driver_id: trip.driver_id,
        from_city: trip.from_city,
        to_city: trip.to_city,
        miles: Math.max(0, Math.round(tripMiles)),
        seats_booked: seatsBooked,
        gross_amount: gross.toFixed(2),
        platform_fee: fees.toFixed(2),
        net_amount: gross.toFixed(2),
        completed_at: now,
      }),
    );

    trip.status = 'completed';
    await this.trips.save(trip);

    return { completed: true };
  }

  private async requireOwnTrip(voyagerId: string, tripId: string) {
    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Adventure not found');
    if (trip.driver_id !== voyagerId) {
      throw new ForbiddenException(
        'Only the Voyager driving this adventure can log odometer readings.',
      );
    }
    return trip;
  }

  /** Mirrors the pre-trip video path: real S3 when configured, disk otherwise. */
  private async storePhoto(key: string, buffer: Buffer, mimeType: string) {
    const awsKey = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const awsSecret = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const hasRealAwsCreds =
      !!awsKey && !!awsSecret && /^AKIA[0-9A-Z]{16}$/.test(awsKey);

    if (hasRealAwsCreds) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: ODOMETER_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ACL: 'private',
        }),
      );
      return;
    }

    const filePath = path.join(UPLOADS_DIR, ODOMETER_BUCKET, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, buffer);
  }
}

export type BookingLegStatus = 'awaiting_pickup' | 'on_board' | 'dropped_off';

function bookingLegStatus(b: MobileBooking): BookingLegStatus {
  if (b.dropoff_miles != null) return 'dropped_off';
  if (b.pickup_miles != null) return 'on_board';
  return 'awaiting_pickup';
}
