import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import {
  MobileTrip,
  MobileTripReply,
  MobileTripReplyRead,
} from '../entities/mobile.entities';

@Injectable()
export class MobileNotificationsService {
  constructor(
    @InjectRepository(MobileTrip)
    private readonly trips: Repository<MobileTrip>,
    @InjectRepository(MobileTripReply)
    private readonly replies: Repository<MobileTripReply>,
    @InjectRepository(MobileTripReplyRead)
    private readonly reads: Repository<MobileTripReplyRead>,
  ) {}

  /**
   * Per-trip unread reply counts for trips the user drives or has replied to.
   * Replies authored by the user never count. Mirrors the Replit contract.
   */
  async unread(userId: string) {
    const [driverTrips, repliedTrips] = await Promise.all([
      this.trips.find({ where: { driver_id: userId }, select: ['id'] }),
      this.replies.find({ where: { user_id: userId }, select: ['trip_id'] }),
    ]);

    const allTripIds = [
      ...new Set([
        ...driverTrips.map((t) => t.id),
        ...repliedTrips.map((r) => r.trip_id),
      ]),
    ];

    if (allTripIds.length === 0) {
      return { unreadTripReplies: [], totalUnread: 0 };
    }

    const [allReplies, readRecords] = await Promise.all([
      this.replies.find({
        where: { trip_id: In(allTripIds), user_id: Not(userId) },
      }),
      this.reads.find({
        where: { user_id: userId, trip_id: In(allTripIds) },
      }),
    ]);

    const EPOCH = new Date(0);
    const readMap = new Map(
      readRecords.map((r) => [r.trip_id, r.last_read_at]),
    );

    const countByTrip = new Map<string, number>();
    for (const reply of allReplies) {
      const lastRead = readMap.get(reply.trip_id) ?? EPOCH;
      if (reply.created_at > lastRead) {
        countByTrip.set(
          reply.trip_id,
          (countByTrip.get(reply.trip_id) ?? 0) + 1,
        );
      }
    }

    const unreadTripReplies = [...countByTrip.entries()].map(
      ([tripId, unreadCount]) => ({ tripId, unreadCount }),
    );
    const totalUnread = unreadTripReplies.reduce(
      (s, r) => s + r.unreadCount,
      0,
    );

    return { unreadTripReplies, totalUnread };
  }
}
