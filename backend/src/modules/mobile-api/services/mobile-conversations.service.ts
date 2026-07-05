import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  MobileBooking,
  MobileConversation,
  MobileDirectMessage,
  MobileTrip,
  MobileUser,
} from '../entities/mobile.entities';

const SUPPORT_EMAIL = 'support@bovogo.com';

function pairIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function formatListTime(d: Date | null): string {
  if (!d) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return 'Yesterday';
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMsgTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

@Injectable()
export class MobileConversationsService {
  constructor(
    @InjectRepository(MobileConversation)
    private readonly conversations: Repository<MobileConversation>,
    @InjectRepository(MobileDirectMessage)
    private readonly messages: Repository<MobileDirectMessage>,
    @InjectRepository(MobileUser)
    private readonly users: Repository<MobileUser>,
    @InjectRepository(MobileBooking)
    private readonly bookings: Repository<MobileBooking>,
    @InjectRepository(MobileTrip)
    private readonly trips: Repository<MobileTrip>,
  ) {}

  async mine(userId: string) {
    const rows = await this.conversations.find({
      where: [{ user_low_id: userId }, { user_high_id: userId }],
    });
    rows.sort((a, b) => {
      const ta = (a.last_message_at ?? a.created_at).getTime();
      const tb = (b.last_message_at ?? b.created_at).getTime();
      return tb - ta;
    });

    const otherIds = rows.map((c) =>
      c.user_low_id === userId ? c.user_high_id : c.user_low_id,
    );
    const others = otherIds.length
      ? await this.users.find({ where: { id: In(otherIds) } })
      : [];
    const nameById = new Map(others.map((u) => [u.id, u.name]));

    const unreadCounts = await this.unreadCounts(userId, rows.map((r) => r.id));

    return {
      conversations: rows.map((c) => {
        const otherId =
          c.user_low_id === userId ? c.user_high_id : c.user_low_id;
        return {
          id: c.id,
          userId: otherId,
          userName: nameById.get(otherId) ?? 'Member',
          lastMessage: c.last_message ?? '',
          time: formatListTime(c.last_message_at),
          unread: (unreadCounts.get(c.id) ?? 0) > 0,
          tripRoute: c.trip_label ?? undefined,
          updatedAt: (c.last_message_at ?? c.created_at).toISOString(),
        };
      }),
    };
  }

  async detail(userId: string, conversationId: string) {
    const conv = await this.requireMember(userId, conversationId);
    const otherId =
      conv.user_low_id === userId ? conv.user_high_id : conv.user_low_id;
    const other = await this.users.findOne({ where: { id: otherId } });

    const rows = await this.messages.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
    });

    // Mark peer messages as read.
    const unread = rows.filter(
      (m) => m.sender_id !== userId && m.read_at == null,
    );
    if (unread.length) {
      const now = new Date();
      for (const m of unread) m.read_at = now;
      await this.messages.save(unread);
    }

    return {
      conversation: {
        id: conv.id,
        userId: otherId,
        userName: other?.name ?? 'Member',
        lastMessage: conv.last_message ?? '',
        time: formatListTime(conv.last_message_at),
        unread: false,
        tripRoute: conv.trip_label ?? undefined,
      },
      messages: rows.map((m) => ({
        id: m.id,
        senderId: m.sender_id,
        text: m.text,
        time: formatMsgTime(m.created_at),
        isMe: m.sender_id === userId,
        createdAt: m.created_at.toISOString(),
      })),
    };
  }

  async postMessage(userId: string, conversationId: string, text: string) {
    const body = text.trim();
    if (!body) throw new BadRequestException('Message cannot be empty.');
    const conv = await this.requireMember(userId, conversationId);

    const inserted = await this.messages.save(
      this.messages.create({
        conversation_id: conversationId,
        sender_id: userId,
        text: body,
        read_at: null,
      }),
    );

    conv.last_message = body;
    conv.last_message_at = inserted.created_at;
    await this.conversations.save(conv);

    return {
      message: {
        id: inserted.id,
        senderId: inserted.sender_id,
        text: inserted.text,
        time: formatMsgTime(inserted.created_at),
        isMe: true,
        createdAt: inserted.created_at.toISOString(),
      },
    };
  }

  /**
   * Open (or create) a DM with another user. Allowed when they share a
   * confirmed booking, or when messaging Bovogo Support.
   */
  async openWith(userId: string, otherUserId: string, tripLabel?: string) {
    if (userId === otherUserId) {
      throw new BadRequestException("You can't message yourself.");
    }
    const other = await this.users.findOne({ where: { id: otherUserId } });
    if (!other) throw new NotFoundException('User not found');

    const allowed = await this.canMessage(userId, otherUserId);
    if (!allowed) {
      throw new ForbiddenException(
        'You can only message people you share an adventure with.',
      );
    }

    const conv = await this.findOrCreatePair(userId, otherUserId, tripLabel);
    return {
      conversation: {
        id: conv.id,
        userId: otherUserId,
        userName: other.name,
        lastMessage: conv.last_message ?? '',
        time: formatListTime(conv.last_message_at),
        unread: false,
        tripRoute: conv.trip_label ?? undefined,
      },
    };
  }

  async openSupport(userId: string) {
    const support = await this.ensureSupportUser();
    const conv = await this.findOrCreatePair(userId, support.id, undefined);
    if (!conv.last_message) {
      const welcome = await this.messages.save(
        this.messages.create({
          conversation_id: conv.id,
          sender_id: support.id,
          text: 'Hello! How can Bovogo Support help you today?',
          read_at: null,
        }),
      );
      conv.last_message = welcome.text;
      conv.last_message_at = welcome.created_at;
      await this.conversations.save(conv);
    }
    return {
      conversation: {
        id: conv.id,
        userId: support.id,
        userName: support.name,
        lastMessage: conv.last_message ?? '',
        time: formatListTime(conv.last_message_at),
        unread: true,
        tripRoute: undefined,
      },
    };
  }

  /** Called after a booking is confirmed — opens a DM between Voyager and Sailor. */
  async ensureForBooking(
    driverId: string,
    riderId: string,
    tripLabel: string,
  ): Promise<void> {
    await this.findOrCreatePair(driverId, riderId, tripLabel);
  }

  private async findOrCreatePair(
    a: string,
    b: string,
    tripLabel?: string,
  ): Promise<MobileConversation> {
    const [low, high] = pairIds(a, b);
    let conv = await this.conversations.findOne({
      where: { user_low_id: low, user_high_id: high },
    });
    if (!conv) {
      conv = await this.conversations.save(
        this.conversations.create({
          user_low_id: low,
          user_high_id: high,
          last_message: null,
          last_message_at: null,
          trip_label: tripLabel ?? null,
        }),
      );
    } else if (tripLabel && !conv.trip_label) {
      conv.trip_label = tripLabel;
      await this.conversations.save(conv);
    }
    return conv;
  }

  private async canMessage(a: string, b: string): Promise<boolean> {
    const support = await this.users.findOne({
      where: { email: SUPPORT_EMAIL },
    });
    if (support && (b === support.id || a === support.id)) return true;

    // Share a confirmed booking as driver/rider.
    const asRider = await this.bookings.find({
      where: [
        { rider_id: a, status: 'confirmed' },
        { rider_id: b, status: 'confirmed' },
      ],
    });
    for (const booking of asRider) {
      const trip = await this.trips.findOne({
        where: { id: booking.trip_id },
      });
      if (!trip) continue;
      if (
        (booking.rider_id === a && trip.driver_id === b) ||
        (booking.rider_id === b && trip.driver_id === a)
      ) {
        return true;
      }
    }
    return false;
  }

  private async requireMember(userId: string, conversationId: string) {
    const conv = await this.conversations.findOne({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.user_low_id !== userId && conv.user_high_id !== userId) {
      throw new NotFoundException('Conversation not found');
    }
    return conv;
  }

  private async unreadCounts(
    userId: string,
    conversationIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (conversationIds.length === 0) return map;
    const rows = await this.messages
      .createQueryBuilder('m')
      .select('m.conversation_id', 'cid')
      .addSelect('COUNT(*)', 'cnt')
      .where('m.conversation_id IN (:...ids)', { ids: conversationIds })
      .andWhere('m.sender_id != :userId', { userId })
      .andWhere('m.read_at IS NULL')
      .groupBy('m.conversation_id')
      .getRawMany<{ cid: string; cnt: string }>();
    for (const r of rows) map.set(r.cid, Number(r.cnt));
    return map;
  }

  private async ensureSupportUser(): Promise<MobileUser> {
    let support = await this.users.findOne({ where: { email: SUPPORT_EMAIL } });
    if (support) return support;
    support = await this.users.save(
      this.users.create({
        name: 'Bovogo Support',
        email: SUPPORT_EMAIL,
        phone: null,
        password_hash: '!', // not used for login
        role: null,
        onboarded: true,
        is_verified: true,
        is_founding_member: false,
      }),
    );
    return support;
  }
}
