import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
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

@Injectable()
export class MobileTripsService {
  constructor(
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
  ) {}

  async list(from?: string, to?: string) {
    const where: FindOptionsWhere<MobileTrip> = { status: 'active' };
    if (from) where.from_city = ILike(from);
    if (to) where.to_city = ILike(to);

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
          driver ?? { id: trip.driver_id, name: 'Voyager', rating: 5, trips: 0 },
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
      price_per_seat: dto.pricePerSeat.toFixed(2),
      note: dto.note ?? '',
      car: dto.car ?? null,
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

  private async decorate(rows: MobileTrip[]) {
    if (rows.length === 0) return [];
    const driverIds = [...new Set(rows.map((r) => r.driver_id))];
    const drivers = await this.users.find({ where: { id: In(driverIds) } });
    const driverById = new Map(drivers.map((d) => [d.id, d]));

    const tripIds = rows.map((r) => r.id);
    const replyRows = await this.replies.find({
      where: { trip_id: In(tripIds) },
    });
    const counts = new Map<string, number>();
    for (const r of replyRows) {
      counts.set(r.trip_id, (counts.get(r.trip_id) ?? 0) + 1);
    }

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
