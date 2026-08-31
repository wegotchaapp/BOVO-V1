import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Between, FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  MobileBooking,
  MobileTrip,
  MobileTripGroup,
  MobileTripGroupMember,
  MobileTripReply,
  MobileTripReplyRead,
  MobileUser,
} from '../entities/mobile.entities';
import { CreateTripBody, CreateReplyBody } from '../dto/mobile.dto';
import { driverSummary, replyToDto, tripToDto } from '../mobile.mappers';
import { findPublicReplyPii } from '../pii-guard';
import { MobileEmailNotificationsService } from './mobile-email-notifications.service';
import { seatPriceForRoute } from '../mobile-pricing';
import { MobileVehiclesService } from './mobile-vehicles.service';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const START_VIDEO_BUCKET = 'bovogo-trip-videos';
const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/3gpp',
  'video/x-matroska',
]);
const VIDEO_EXT_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
  'video/x-matroska': 'mkv',
};

export interface UploadedVideoFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/** "Silver Toyota Camry" — what a Sailor looks for at the kerb. */
function describeVehicle(v: {
  color?: string | null;
  make?: string | null;
  model?: string | null;
}): string | null {
  const parts = [v.color, v.make, v.model]
    .map((p) => (p ?? '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

@Injectable()
export class MobileTripsService {
  private readonly s3: S3Client;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(MobileTrip)
    private readonly trips: Repository<MobileTrip>,
    @InjectRepository(MobileTripReply)
    private readonly replies: Repository<MobileTripReply>,
    @InjectRepository(MobileTripReplyRead)
    private readonly reads: Repository<MobileTripReplyRead>,
    @InjectRepository(MobileUser)
    private readonly users: Repository<MobileUser>,
    @InjectRepository(MobileBooking)
    private readonly bookings: Repository<MobileBooking>,
    @InjectRepository(MobileTripGroup)
    private readonly groups: Repository<MobileTripGroup>,
    @InjectRepository(MobileTripGroupMember)
    private readonly groupMembers: Repository<MobileTripGroupMember>,
    private readonly emailNotifications: MobileEmailNotificationsService,
    private readonly vehiclesService: MobileVehiclesService,
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

  async list(from?: string, to?: string, date?: string) {
    const where: FindOptionsWhere<MobileTrip> = { status: 'active' };
    if (from) where.from_city = ILike(from);
    if (to) where.to_city = ILike(to);

    // Narrow to the requested calendar day, local to the server. An unparseable
    // date is ignored rather than returning nothing — a bad param should not
    // look identical to "no adventures on this route".
    if (date) {
      const start = new Date(`${date}T00:00:00`);
      if (!Number.isNaN(start.getTime())) {
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        where.departure_at = Between(start, end);
      }
    }

    const rows = await this.trips.find({
      where,
      order: { departure_at: 'ASC' },
      take: 50,
    });
    return { trips: await this.decorate(rows) };
  }

  async mine(driverId: string) {
    const rows = await this.trips.find({
      where: { driver_id: driverId },
      order: { departure_at: 'ASC' },
    });
    return { trips: await this.decorate(rows) };
  }

  async getOne(id: string, viewerId?: string) {
    const trip = await this.trips.findOne({ where: { id } });
    if (!trip) throw new NotFoundException('Trip not found');

    const driver = await this.users.findOne({ where: { id: trip.driver_id } });
    const replyRows = await this.replies.find({
      where: { trip_id: id },
      order: { created_at: 'ASC' },
    });

    const confirmedBookings = await this.bookings.find({
      where: { trip_id: id, status: 'confirmed' },
    });
    const bookedRiderIds = [
      ...new Set(confirmedBookings.map((b) => b.rider_id)),
    ];
    const bookedRiderSet = new Set(bookedRiderIds);

    const authorIds = [...new Set(replyRows.map((r) => r.user_id))];
    const authors = authorIds.length
      ? await this.users.find({ where: { id: In(authorIds) } })
      : [];
    const nameById = new Map(authors.map((a) => [a.id, a.name]));

    const replies = replyRows.map((r) =>
      replyToDto(
        r,
        r.user_id === trip.driver_id,
        nameById.get(r.user_id) ?? 'Unknown',
        bookedRiderSet.has(r.user_id),
      ),
    );

    let viewerHasBooked = false;
    let viewerGroupId: string | null = null;
    if (viewerId) {
      viewerHasBooked = bookedRiderSet.has(viewerId);
      const group = await this.groups.findOne({ where: { trip_id: id } });
      if (group) {
        const membership = await this.groupMembers.findOne({
          where: { group_id: group.id, user_id: viewerId },
        });
        if (membership) viewerGroupId = group.id;
      }
    }

    return {
      trip: tripToDto(
        trip,
        driverSummary(
          driver ?? {
            id: trip.driver_id,
            name: 'Voyager',
            rating: 5,
            trips: 0,
          },
        ),
        replies.length,
      ),
      replies,
      meta: {
        bookedRiderIds,
        viewerHasBooked,
        viewerGroupId,
      },
    };
  }

  async create(driverId: string, dto: CreateTripBody) {
    // A Voyager may only post once their vehicle is fully documented: VIN,
    // seat/door counts, all five photos, insurance and registration. Enforced
    // here rather than only in the UI so it cannot be bypassed via the API.
    const vehicle = await this.vehiclesService.assertReadyToDrive(driverId);

    const departure = new Date(dto.departureAt);
    if (Number.isNaN(departure.getTime())) {
      throw new BadRequestException('Invalid departureAt timestamp');
    }
    if (dto.fromCity === dto.toCity) {
      throw new BadRequestException('From and To must be different cities.');
    }
    if (departure.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('Departure must be in the future.');
    }

    const trip = this.trips.create({
      driver_id: driverId,
      from_city: dto.fromCity,
      to_city: dto.toCity,
      departure_at: departure,
      seats_available: dto.seatsAvailable,
      luggage_space: dto.luggageSpace ?? 0,
      // Server-authoritative: the client's pricePerSeat is ignored so a
      // Voyager cannot post a seat above the cost-share ceiling.
      price_per_seat: seatPriceForRoute(dto.fromCity, dto.toCity).toFixed(2),
      note: dto.note ?? '',
      // Posting is already gated on a fully documented vehicle, so the car is
      // known here. It used to come only from the client, which never sent it —
      // leaving every trip with an empty car, so Sailors saw "Vehicle" on
      // tracking and "—" on the adventure detail and had nothing to identify at
      // pickup. The client may still override it.
      car: dto.car?.trim() || describeVehicle(vehicle),
      pref_smoking: dto.preferences?.smoking ?? false,
      pref_pets: dto.preferences?.pets ?? false,
      pref_music: dto.preferences?.music ?? true,
      pref_ac: dto.preferences?.ac ?? true,
      status: 'active',
    });
    const saved = await this.trips.save(trip);
    const driver = await this.users.findOne({ where: { id: driverId } });
    return {
      trip: tripToDto(
        saved,
        driverSummary(
          driver ?? { id: driverId, name: 'Voyager', rating: 5, trips: 0 },
        ),
        0,
      ),
    };
  }

  async cancel(driverId: string, id: string) {
    const trip = await this.trips.findOne({ where: { id } });
    if (!trip) throw new NotFoundException('Adventure not found');
    if (trip.driver_id !== driverId) {
      throw new ForbiddenException('You can only cancel your own adventures.');
    }
    if (trip.status !== 'cancelled') {
      trip.status = 'cancelled';
      await this.trips.save(trip);
    }
    return { ok: true };
  }

  /**
   * Stores the mandatory pre-trip car video recorded live by the driver.
   * The trip cannot transition to `in_progress` until this succeeds.
   */
  async uploadStartVideo(
    driverId: string,
    tripId: string,
    file: UploadedVideoFile | undefined,
  ) {
    const trip = await this.requireOwnTrip(driverId, tripId);
    if (trip.status === 'cancelled' || trip.status === 'completed') {
      throw new BadRequestException(
        'This adventure is no longer active, so a start video cannot be added.',
      );
    }

    if (!file || !file.buffer?.length) {
      throw new BadRequestException('A video file is required.');
    }
    if (!ALLOWED_VIDEO_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported video format. Please record the video with your camera.',
      );
    }

    const ext = VIDEO_EXT_BY_MIME[file.mimetype] ?? 'mp4';
    const key = `trips/${tripId}/start-video-${randomUUID()}.${ext}`;
    await this.storeVideo(key, file.buffer, file.mimetype);

    const appUrl = this.config.get('APP_URL') || 'http://localhost:3000';
    trip.start_video_url = `${appUrl}/uploads/${START_VIDEO_BUCKET}/${key}`;
    await this.trips.save(trip);

    const driver = await this.users.findOne({ where: { id: driverId } });
    if (driver) {
      await this.emailNotifications.sendPreTripVideoReceivedEmail({
        driver,
        trip,
      });
    }

    return { ok: true, startVideoUrl: trip.start_video_url };
  }

  /** Marks the trip started. Rejects unless the mandatory car video was uploaded. */
  async start(driverId: string, tripId: string) {
    const trip = await this.requireOwnTrip(driverId, tripId);
    if (trip.status === 'cancelled' || trip.status === 'completed') {
      throw new BadRequestException('This adventure can no longer be started.');
    }
    if (!trip.start_video_url) {
      throw new BadRequestException(
        'You must record a video of your car before starting the adventure.',
      );
    }
    if (trip.status !== 'in_progress') {
      trip.status = 'in_progress';
      trip.started_at = new Date();
      await this.trips.save(trip);
    }

    const driver = await this.users.findOne({ where: { id: driverId } });
    return {
      trip: tripToDto(
        trip,
        driverSummary(
          driver ?? { id: driverId, name: 'Voyager', rating: 5, trips: 0 },
        ),
        0,
      ),
    };
  }

  private async requireOwnTrip(driverId: string, tripId: string) {
    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Adventure not found');
    if (trip.driver_id !== driverId) {
      throw new ForbiddenException(
        'Only the Voyager who posted this adventure can start it.',
      );
    }
    return trip;
  }

  private async storeVideo(key: string, buffer: Buffer, mimeType: string) {
    const awsKey = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const awsSecret = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    // Real AWS access keys are AKIA + 16 uppercase alphanumerics; placeholders
    // like AKIA_local_mock / AKIA_your-aws-key fall through to local storage.
    const hasRealAwsCreds =
      !!awsKey && !!awsSecret && /^AKIA[0-9A-Z]{16}$/.test(awsKey);

    if (hasRealAwsCreds) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: START_VIDEO_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ACL: 'private',
        }),
      );
      return;
    }

    // Local/dev fallback mirrors profiles.service.ts: write under uploads/.
    const filePath = path.join(UPLOADS_DIR, START_VIDEO_BUCKET, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
  }

  async reply(userId: string, tripId: string, dto: CreateReplyBody) {
    const trip = await this.trips.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('Reply cannot be empty.');
    }

    const piiHit = findPublicReplyPii(text);
    if (piiHit) {
      throw new BadRequestException(
        `Public replies cannot include ${piiHit}. Book your seat to chat privately with the Voyager.`,
      );
    }

    // Voyagers may post only one public reply per adventure.
    if (userId === trip.driver_id) {
      const existingDriverReply = await this.replies.findOne({
        where: { trip_id: tripId, user_id: userId },
      });
      if (existingDriverReply) {
        throw new BadRequestException(
          'Voyagers can only post one public reply on their adventure.',
        );
      }
    }

    const inserted = await this.replies.save(
      this.replies.create({
        trip_id: tripId,
        user_id: userId,
        text,
      }),
    );
    const author = await this.users.findOne({ where: { id: userId } });
    const hasBookedSeat = !!(await this.bookings.findOne({
      where: { trip_id: tripId, rider_id: userId, status: 'confirmed' },
    }));
    return {
      reply: replyToDto(
        inserted,
        userId === trip.driver_id,
        author?.name ?? 'Unknown',
        hasBookedSeat,
      ),
    };
  }

  async markRead(userId: string, tripId: string) {
    const existing = await this.reads.findOne({
      where: { user_id: userId, trip_id: tripId },
    });
    if (existing) {
      existing.last_read_at = new Date();
      await this.reads.save(existing);
    } else {
      await this.reads.save(
        this.reads.create({
          user_id: userId,
          trip_id: tripId,
          last_read_at: new Date(),
        }),
      );
    }
    return { ok: true };
  }

  /**
   * Reply counts, computed in the database. Loading the reply rows themselves
   * would mean pulling 10,000 records into memory to produce 50 integers on a
   * busy feed.
   */
  private replyCountsFor(
    tripIds: string[],
  ): Promise<{ trip_id: string; count: string }[]> {
    if (tripIds.length === 0) return Promise.resolve([]);
    return this.replies
      .createQueryBuilder('r')
      .select('r.trip_id', 'trip_id')
      .addSelect('COUNT(*)', 'count')
      .where('r.trip_id IN (:...tripIds)', { tripIds })
      .groupBy('r.trip_id')
      .getRawMany();
  }

  private async decorate(rows: MobileTrip[]) {
    if (rows.length === 0) return [];
    const driverIds = [...new Set(rows.map((r) => r.driver_id))];
    const tripIds = rows.map((r) => r.id);

    // Independent queries — issue them together rather than back to back, so
    // the feed costs one round-trip's latency instead of two.
    const [drivers, countRows] = await Promise.all([
      this.users.find({ where: { id: In(driverIds) } }),
      this.replyCountsFor(tripIds),
    ]);
    const driverById = new Map(drivers.map((d) => [d.id, d]));
    const counts = new Map<string, number>(
      countRows.map((r) => [r.trip_id, Number(r.count)]),
    );

    return rows.map((t) => {
      const d = driverById.get(t.driver_id);
      return tripToDto(
        t,
        driverSummary(
          d ?? { id: t.driver_id, name: 'Voyager', rating: 5, trips: 0 },
        ),
        counts.get(t.id) ?? 0,
      );
    });
  }
}
