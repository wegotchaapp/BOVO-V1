import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MobileBooking,
  MobileRating,
  MobileTrip,
  MobileUser,
} from '../entities/mobile.entities';
import { SubmitRatingBody } from '../dto/mobile.dto';

@Injectable()
export class MobileRatingsService {
  constructor(
    @InjectRepository(MobileRating)
    private readonly ratings: Repository<MobileRating>,
    @InjectRepository(MobileBooking)
    private readonly bookings: Repository<MobileBooking>,
    @InjectRepository(MobileTrip)
    private readonly trips: Repository<MobileTrip>,
    @InjectRepository(MobileUser)
    private readonly users: Repository<MobileUser>,
  ) {}

  async status(userId: string, bookingId: string) {
    const existing = await this.ratings.findOne({
      where: { booking_id: bookingId, rater_id: userId },
    });
    return { rated: !!existing };
  }

  async submit(userId: string, dto: SubmitRatingBody) {
    const booking = await this.bookings.findOne({
      where: { id: dto.bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'confirmed' && booking.status !== 'completed') {
      throw new BadRequestException('Only completed adventures can be rated.');
    }

    const trip = await this.trips.findOne({ where: { id: booking.trip_id } });
    if (!trip) throw new NotFoundException('Booking not found');

    const isRider = booking.rider_id === userId;
    const isDriver = trip.driver_id === userId;
    if (!isRider && !isDriver) {
      throw new NotFoundException('Booking not found');
    }

    const rateeId = isRider ? trip.driver_id : booking.rider_id;
    if (rateeId === userId) {
      throw new BadRequestException("You can't rate yourself.");
    }

    const existing = await this.ratings.findOne({
      where: { booking_id: booking.id, rater_id: userId },
    });
    if (existing) {
      throw new ConflictException('You already rated this adventure.');
    }

    const tags = (dto.tags ?? []).map(String).slice(0, 10);
    const saved = await this.ratings.save(
      this.ratings.create({
        booking_id: booking.id,
        rater_id: userId,
        ratee_id: rateeId,
        score: dto.score,
        comment: dto.comment?.trim() || null,
        tags: JSON.stringify(tags),
      }),
    );

    await this.recomputeUserRating(rateeId);

    return {
      rating: {
        id: saved.id,
        bookingId: saved.booking_id,
        score: saved.score,
        comment: saved.comment,
        tags,
        createdAt: saved.created_at.toISOString(),
      },
    };
  }

  private async recomputeUserRating(userId: string) {
    const rows = await this.ratings.find({ where: { ratee_id: userId } });
    if (rows.length === 0) return;
    const avg = rows.reduce((sum, r) => sum + r.score, 0) / rows.length;
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return;
    user.rating = avg.toFixed(2);
    user.trips = rows.length;
    await this.users.save(user);
  }
}
