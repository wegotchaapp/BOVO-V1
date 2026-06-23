import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ChatConversation, ChatMessage, ChatBlock, Rating, CallRecord } from '../../database/entities/chat.entities';
import { Booking } from '../../database/entities/booking.entities';
import { User } from '../../database/entities/user.entity';
import { SendMessageDto, SubmitRatingDto } from './chat.dto';
import { ChatMessageFlagCategory, BookingStatus } from '../../common/enums';
import { PinoLogger } from 'nestjs-pino';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeGateway } from '../../common/gateways/realtime.gateway';
import {
  CONTACT_INFO_PATTERNS,
  HARASSMENT_PATTERNS,
  SCAM_PATTERNS,
} from './chat.constants';
import Filter from 'bad-words';
import { Twilio } from 'twilio';

@Injectable()
export class ChatService {
  private profanityFilter: Filter;
  private twilio: Twilio;

  constructor(
    @InjectRepository(ChatConversation)
    private readonly conversationRepo: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    @InjectRepository(ChatBlock)
    private readonly chatBlockRepo: Repository<ChatBlock>,
    @InjectRepository(Rating)
    private readonly ratingRepo: Repository<Rating>,
    @InjectRepository(CallRecord)
    private readonly callRecordRepo: Repository<CallRecord>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {
    this.profanityFilter = new Filter();
    this.twilio = new Twilio(
      this.config.get('TWILIO_ACCOUNT_SID'),
      this.config.get('TWILIO_AUTH_TOKEN'),
    );
  }

  async ensureConversation(bookingId: string, participantIds: string[], title?: string): Promise<ChatConversation> {
    let conversation = await this.conversationRepo.findOne({
      where: { booking_id: bookingId },
    });

    if (!conversation) {
      const booking = await this.bookingRepo.findOne({
        where: { id: bookingId },
        relations: ['trip'],
      });

      const expiryDate = booking?.trip?.departure_date
        ? new Date(new Date(booking.trip.departure_date).getTime() + 7 * 86400000)
        : new Date(Date.now() + 7 * 86400000);

      const routeTitle = title || (booking?.trip ? `${booking.trip.origin_metro} \u2192 ${booking.trip.dest_metro}` : 'Adventure Group');

      conversation = this.conversationRepo.create({
        booking_id: bookingId,
        participant_ids: participantIds,
        title: routeTitle,
        type: 'booking',
        expires_at: expiryDate.toISOString(),
      });
      await this.conversationRepo.save(conversation);

      this.logger.info(
        { bookingId, conversationId: conversation.id },
        'Conversation auto-created on booking confirmation',
      );
    }

    return conversation;
  }

  async sendMessage(
    senderId: string,
    bookingId: string,
    dto: SendMessageDto,
  ): Promise<{
    message: ChatMessage;
    warning?: string;
    flagged: boolean;
    flag_category: string | null;
  }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (!['confirmed', 'en_route', 'in_progress', 'completed'].includes(booking.status)) {
      throw new BadRequestException('Chat is not available for this booking');
    }

    if (booking.trip?.departure_date) {
      const departureDate = new Date(booking.trip.departure_date);
      const now = new Date();
      const daysSinceTrip = (now.getTime() - departureDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceTrip > 7) {
        throw new BadRequestException('Chat has expired — 7 days post-trip limit');
      }
    }

    const driverId = booking.trip?.driver_id;
    const riderId = booking.rider_id;

    if (senderId !== driverId && senderId !== riderId) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const isBlocked = await this.chatBlockRepo.findOne({
      where: [
        { blocker_id: senderId, blocked_user_id: senderId === driverId ? riderId : driverId },
        { blocker_id: senderId === driverId ? riderId : driverId, blocked_user_id: senderId },
      ],
    });

    if (isBlocked) {
      throw new ForbiddenException('Cannot send messages — you have been blocked or have blocked this user');
    }

    let conversation = await this.conversationRepo.findOne({
      where: { booking_id: bookingId },
    });

    if (!conversation) {
      const expiryDate = booking.trip?.departure_date
        ? new Date(new Date(booking.trip.departure_date).getTime() + 7 * 86400000)
        : new Date(Date.now() + 7 * 86400000);

      const routeTitle = booking.trip ? `${booking.trip.origin_metro} \u2192 ${booking.trip.dest_metro}` : 'Adventure Group';
      conversation = this.conversationRepo.create({
        booking_id: bookingId,
        participant_ids: [driverId, riderId],
        title: routeTitle,
        type: 'booking',
        expires_at: expiryDate.toISOString(),
      });
      await this.conversationRepo.save(conversation);
    }

    const analysis = this.analyzeMessage(dto.content);
    const isProfane = this.profanityFilter.isProfane(dto.content);

    let isFlagged = false;
    let flagCategory: string | null = null;

    if (isProfane) {
      isFlagged = true;
      flagCategory = ChatMessageFlagCategory.PROFANITY;
    } else if (analysis.flags.length > 0) {
      isFlagged = true;
      flagCategory = analysis.flags[0];
    }

    const message = this.messageRepo.create({
      conversation_id: conversation.id,
      sender_id: senderId,
      content: dto.content,
      is_flagged: isFlagged,
      flag_category: flagCategory,
      requires_review: analysis.requiresReview,
    });

    const saved = await this.messageRepo.save(message);

    const unreadField = senderId === driverId ? 'unread_count_rider' : 'unread_count_driver';
    await this.conversationRepo.update(conversation.id, {
      last_message: dto.content.substring(0, 500),
      last_message_sender_id: senderId,
      last_message_at: new Date().toISOString(),
      [unreadField]: () => `"${unreadField}" + 1`,
    });

    const recipientId = senderId === driverId ? riderId : driverId;
    if (!analysis.requiresReview) {
      await this.notifications.send(
        recipientId,
        'in_trip',
        'New message',
        dto.content.substring(0, 100),
        { booking_id: bookingId, screen: `chat/${bookingId}` },
      );
    }

    if (isFlagged) {
      await this.audit.log({
        actor_id: senderId,
        entity_type: 'chat_message',
        entity_id: saved.id,
        event_type: 't&s_action',
        payload: {
          flag_category: flagCategory,
          content_preview: dto.content.substring(0, 50),
          booking_id: bookingId,
        },
      });
    }

    this.logger.info(
      { messageId: saved.id, senderId, bookingId, isFlagged },
      'Chat message sent',
    );

    this.realtimeGateway.emitNewMessage(conversation.id, {
      id: saved.id,
      conversation_id: saved.conversation_id,
      sender_id: saved.sender_id,
      content: saved.content,
      is_flagged: saved.is_flagged,
      flag_category: saved.flag_category,
      is_read: saved.is_read,
      created_at: saved.created_at,
    });

    const otherParticipantIds = conversation.participant_ids.filter((id) => id !== senderId);
    otherParticipantIds.forEach((userId) => {
      this.realtimeGateway.emitConversationUpdated(userId);
    });

    return {
      message: saved,
      warning: analysis.warning,
      flagged: isFlagged,
      flag_category: flagCategory,
    };
  }

  async getMessages(
    userId: string,
    bookingId: string,
    cursor?: string,
    limit = 50,
  ): Promise<{ messages: ChatMessage[]; has_more: boolean; next_cursor?: string }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const driverId = booking.trip?.driver_id;
    const riderId = booking.rider_id;

    if (userId !== driverId && userId !== riderId) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const conversation = await this.conversationRepo.findOne({
      where: { booking_id: bookingId },
    });

    if (!conversation) {
      return { messages: [], has_more: false };
    }

    const query: any = { conversation_id: conversation.id };
    if (cursor) {
      const cursorMessage = await this.messageRepo.findOne({ where: { id: cursor } });
      if (cursorMessage) {
        query.created_at = LessThan(cursorMessage.created_at);
      }
    }

    const messages = await this.messageRepo.find({
      where: query,
      order: { created_at: 'DESC' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1].id : undefined;

    return {
      messages: messages.reverse(),
      has_more: hasMore,
      next_cursor: nextCursor,
    };
  }

  async getConversations(userId: string): Promise<any[]> {
    const conversations = await this.conversationRepo
      .createQueryBuilder('c')
      .where(':userId = ANY(c.participant_ids)', { userId })
      .andWhere('c.type != :type', { type: 'dm' })
      .orderBy('c.last_message_at', 'DESC', 'NULLS LAST')
      .getMany();

    const results: any[] = [];

    for (const conv of conversations) {
      if (!conv.booking_id) continue;
      const booking = await this.bookingRepo.findOne({
        where: { id: conv.booking_id },
        relations: ['trip', 'trip.driver', 'rider'],
      });
      if (!booking) continue;

      const otherUserId = conv.participant_ids.find((id) => id !== userId);
      if (!otherUserId) continue;

      const otherUser = await this.userRepo.findOne({
        where: { id: otherUserId },
        select: ['id', 'name', 'display_name'],
      });
      if (!otherUser) continue;

      const isDriver = booking.trip?.driver_id === userId;
      const unreadCount = isDriver ? conv.unread_count_driver : conv.unread_count_rider;

      const isUpcoming = ['confirmed'].includes(booking.status);
      const isActive = ['en_route', 'in_progress'].includes(booking.status);

      results.push({
        id: conv.id,
        booking_id: conv.booking_id,
        participant_ids: conv.participant_ids,
        title: conv.title || undefined,
        last_message: conv.last_message,
        last_message_at: conv.last_message_at,
        unread_count: unreadCount,
        other_user: {
          id: otherUser.id,
          name: otherUser.display_name || otherUser.name,
        },
        booking_status: booking.status,
        is_upcoming: isUpcoming,
        is_active: isActive,
        trip_details: {
          origin_metro: booking.trip?.origin_metro,
          dest_metro: booking.trip?.dest_metro,
          departure_date: booking.trip?.departure_date,
          departure_time: booking.trip?.departure_time,
        },
        created_at: conv.created_at,
      });
    }

    return results;
  }

  async markMessagesAsRead(userId: string, bookingId: string): Promise<void> {
    const conversation = await this.conversationRepo.findOne({
      where: { booking_id: bookingId },
    });
    if (!conversation) return;

    const isDriver = conversation.participant_ids[0] === userId;
    const unreadField = isDriver ? 'unread_count_driver' : 'unread_count_rider';

    await this.messageRepo.update(
      { conversation_id: conversation.id, sender_id: userId === conversation.participant_ids[0] ? conversation.participant_ids[1] : conversation.participant_ids[0], is_read: false },
      { is_read: true, read_at: new Date().toISOString() },
    );

    await this.conversationRepo.update(conversation.id, { [unreadField]: 0 });
  }

  async markConversationRead(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });
    if (!conversation) return;

    const isDriver = conversation.participant_ids[0] === userId;
    const unreadField = isDriver ? 'unread_count_driver' : 'unread_count_rider';

    await this.messageRepo.update(
      { conversation_id: conversationId, is_read: false },
      { is_read: true, read_at: new Date().toISOString() },
    );

    await this.conversationRepo.update(conversationId, { [unreadField]: 0 });
  }

  async getDms(userId: string): Promise<any[]> {
    const conversations = await this.conversationRepo
      .createQueryBuilder('c')
      .where('c.type = :type', { type: 'dm' })
      .andWhere(':userId = ANY(c.participant_ids)', { userId })
      .orderBy('c.last_message_at', 'DESC', 'NULLS LAST')
      .getMany();

    const results: any[] = [];
    for (const conv of conversations) {
      const otherUserId = conv.participant_ids.find((id) => id !== userId);
      if (!otherUserId) continue;

      const otherUser = await this.userRepo.findOne({
        where: { id: otherUserId },
        select: ['id', 'name', 'display_name'],
      });

      const myIndex = conv.participant_ids.indexOf(userId);
      const unreadCount = myIndex === 0 ? conv.unread_count_driver : conv.unread_count_rider;

      results.push({
        id: conv.id,
        title: conv.title || otherUser?.display_name || otherUser?.name || 'Chat',
        last_message: conv.last_message,
        last_message_at: conv.last_message_at,
        unread_count: unreadCount,
        other_user: otherUser ? { id: otherUser.id, name: otherUser.display_name || otherUser.name } : null,
        created_at: conv.created_at,
      });
    }
    return results;
  }

  async initiateSupport(userId: string): Promise<any> {
    const existing = await this.conversationRepo
      .createQueryBuilder('c')
      .where('c.type = :type', { type: 'dm' })
      .andWhere(':userId = ANY(c.participant_ids)', { userId })
      .andWhere('c.title = :title', { title: 'Bovogo Support' })
      .getOne();

    if (existing) {
      return { id: existing.id, title: 'Bovogo Support', is_support: true };
    }

    const conversation = this.conversationRepo.create({
      booking_id: null,
      participant_ids: [userId, 'system-support'],
      title: 'Bovogo Support',
      type: 'dm',
    });
    const saved = await this.conversationRepo.save(conversation);
    return { id: saved.id, title: 'Bovogo Support', is_support: true };
  }

  async blockUser(blockerId: string, bookingId: string, blockedUserId: string): Promise<void> {
    const booking = await this.bookingRepo.findOne({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');

    const existing = await this.chatBlockRepo.findOne({
      where: { blocker_id: blockerId, blocked_user_id: blockedUserId },
    });
    if (existing) return;

    const block = this.chatBlockRepo.create({
      blocker_id: blockerId,
      blocked_user_id: blockedUserId,
      booking_id: bookingId,
    });

    await this.chatBlockRepo.save(block);

    await this.audit.log({
      actor_id: blockerId,
      entity_type: 'chat_block',
      entity_id: block.id,
      event_type: 'account_change',
      payload: { blocked_user_id: blockedUserId, booking_id: bookingId },
    });

    this.logger.info(
      { blockerId, blockedUserId, bookingId },
      'User blocked in chat',
    );
  }

  async submitRating(
    raterId: string,
    bookingId: string,
    dto: SubmitRatingDto,
  ): Promise<{ rating: Rating; released: boolean; counterpart_rating?: Rating }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status !== 'completed') {
      throw new BadRequestException('Can only rate after trip completion');
    }

    const driverId = booking.trip?.driver_id;
    const riderId = booking.rider_id;

    if (raterId !== driverId && raterId !== riderId) {
      throw new ForbiddenException('Only trip participants can rate');
    }

    const ratedUserId = raterId === driverId ? riderId : driverId;

    const existing = await this.ratingRepo.findOne({
      where: { booking_id: bookingId, rater_id: raterId },
    });
    if (existing) {
      throw new BadRequestException('You have already submitted a rating for this booking');
    }

    const rating = this.ratingRepo.create({
      booking_id: bookingId,
      rater_id: raterId,
      rated_user_id: ratedUserId,
      score: dto.score,
      comment: dto.comment || null,
      tags: dto.tags || [],
      is_released: false,
    });

    const saved = await this.ratingRepo.save(rating);

    const counterpartRating = await this.ratingRepo.findOne({
      where: { booking_id: bookingId, rater_id: ratedUserId },
    });

    let released = false;
    let counterpartRatingData: Rating | undefined;

    if (counterpartRating) {
      await this.ratingRepo.update(saved.id, { is_released: true });
      await this.ratingRepo.update(counterpartRating.id, { is_released: true });
      released = true;
      counterpartRatingData = counterpartRating;
    } else {
      await this.scheduleRatingRelease(bookingId, raterId, ratedUserId);
    }

    await this.updateUserAverageRating(ratedUserId);

    await this.audit.log({
      actor_id: raterId,
      entity_type: 'rating',
      entity_id: saved.id,
      event_type: 'payment_event',
      payload: {
        booking_id: bookingId,
        score: dto.score,
        rated_user_id: ratedUserId,
        released,
      },
    });

    return {
      rating: saved,
      released,
      counterpart_rating: counterpartRatingData,
    };
  }

  async getMyProfileRating(userId: string): Promise<{ average_rating: number | null; total_ratings: number; released: boolean }> {
    const ratings = await this.ratingRepo.find({
      where: { rated_user_id: userId, is_released: true },
    });

    if (ratings.length < 5) {
      return { average_rating: null, total_ratings: ratings.length, released: false };
    }

    const avg = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;

    return {
      average_rating: Math.round(avg * 10) / 10,
      total_ratings: ratings.length,
      released: true,
    };
  }

  async getRatingStatus(bookingId: string, userId: string): Promise<{
    has_rated: boolean;
    counterpart_rated: boolean;
    both_rated: boolean;
    can_rate: boolean;
    hours_until_expiry: number | null;
  }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const driverId = booking.trip?.driver_id;
    const riderId = booking.rider_id;
    const counterpartId = userId === driverId ? riderId : driverId;

    const myRating = await this.ratingRepo.findOne({
      where: { booking_id: bookingId, rater_id: userId },
    });

    const counterpartRating = await this.ratingRepo.findOne({
      where: { booking_id: bookingId, rater_id: counterpartId },
    });

    let hoursUntilExpiry: number | null = null;
    if (booking.updated_at) {
      const completedAt = new Date(booking.updated_at);
      const expiryDate = new Date(completedAt.getTime() + 72 * 3600000);
      hoursUntilExpiry = Math.max(0, (expiryDate.getTime() - Date.now()) / 3600000);
    }

    return {
      has_rated: !!myRating,
      counterpart_rated: !!counterpartRating,
      both_rated: !!myRating && !!counterpartRating,
      can_rate: !myRating && booking.status === 'completed',
      hours_until_expiry: hoursUntilExpiry,
    };
  }

  async initiateMaskedCall(
    callerId: string,
    bookingId: string,
  ): Promise<{ proxy_number: string; call_sid: string; receiver_first_name: string }> {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip', 'trip.driver', 'rider'],
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (!['confirmed', 'en_route', 'in_progress'].includes(booking.status)) {
      throw new BadRequestException('Calls only available for active trips');
    }

    const driverId = booking.trip?.driver_id;
    const riderId = booking.rider_id;

    if (callerId !== driverId && callerId !== riderId) {
      throw new ForbiddenException('Only trip participants can call');
    }

    const isBlocked = await this.chatBlockRepo.findOne({
      where: [
        { blocker_id: callerId, blocked_user_id: callerId === driverId ? riderId : driverId },
        { blocker_id: callerId === driverId ? riderId : driverId, blocked_user_id: callerId },
      ],
    });

    if (isBlocked) {
      throw new ForbiddenException('Cannot call — you have been blocked or have blocked this user');
    }

    const caller = await this.userRepo.findOne({ where: { id: callerId } });
    const receiver = await this.userRepo.findOne({
      where: { id: callerId === driverId ? riderId : driverId },
    });

    if (!caller?.phone || !receiver?.phone) {
      throw new BadRequestException('Phone numbers not available for masked calling');
    }

    const proxyNumber = this.config.get('TWILIO_PROXY_NUMBER') || this.config.get('TWILIO_PHONE_NUMBER');
    if (!proxyNumber) {
      throw new BadRequestException('Twilio proxy number not configured');
    }

    try {
      const twimlUrl = `${this.config.get('APP_URL')}/chat/calls/twiml/${bookingId}`;

      const call = await this.twilio.calls.create({
        url: twimlUrl,
        to: caller.phone,
        from: proxyNumber,
        statusCallback: `${this.config.get('APP_URL')}/chat/calls/webhook/${bookingId}`,
        statusCallbackMethod: 'POST',
      });

      const callRecord = this.callRecordRepo.create({
        booking_id: bookingId,
        caller_id: callerId,
        receiver_id: receiver.id,
        twilio_call_sid: call.sid,
      });

      await this.callRecordRepo.save(callRecord);

      await this.audit.log({
        actor_id: callerId,
        entity_type: 'call_record',
        entity_id: callRecord.id,
        event_type: 't&s_action',
        payload: { booking_id: bookingId, receiver_id: receiver.id, call_sid: call.sid },
      });

      this.logger.info(
        { callSid: call.sid, callerId, receiverId: receiver.id, bookingId },
        'Masked call initiated',
      );

      return {
        proxy_number: proxyNumber,
        call_sid: call.sid,
        receiver_first_name: receiver.name.split(' ')[0],
      };
    } catch (err) {
      this.logger.error({ err, bookingId }, 'Failed to initiate masked call');
      throw new BadRequestException('Failed to initiate call. Please try again.');
    }
  }

  async handleCallWebhook(bookingId: string, payload: any): Promise<void> {
    const { CallSid, CallDuration, CallStatus } = payload;

    const callRecord = await this.callRecordRepo.findOne({
      where: { twilio_call_sid: CallSid },
    });

    if (callRecord) {
      const updates: any = { status: CallStatus };
      if (CallDuration) {
        updates.duration_seconds = parseInt(CallDuration, 10);
      }

      await this.callRecordRepo.update(callRecord.id, updates);

      await this.audit.log({
        actor_id: null,
        entity_type: 'call_record',
        entity_id: callRecord.id,
        event_type: 't&s_action',
        payload: { booking_id: bookingId, status: CallStatus, duration: CallDuration },
      });
    }
  }

  async getDmMessages(
    userId: string,
    conversationId: string,
    cursor?: string,
    limit = 50,
  ): Promise<{ messages: ChatMessage[]; has_more: boolean; next_cursor?: string }> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (!conversation.participant_ids.includes(userId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const query: any = { conversation_id: conversationId };
    if (cursor) {
      const cursorMessage = await this.messageRepo.findOne({ where: { id: cursor } });
      if (cursorMessage) {
        query.created_at = LessThan(cursorMessage.created_at);
      }
    }

    const messages = await this.messageRepo.find({
      where: query,
      order: { created_at: 'DESC' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1].id : undefined;

    return {
      messages: messages.reverse(),
      has_more: hasMore,
      next_cursor: nextCursor,
    };
  }

  async sendDmMessage(
    senderId: string,
    conversationId: string,
    dto: SendMessageDto,
  ): Promise<{
    message: ChatMessage;
    warning?: string;
    flagged: boolean;
    flag_category: string | null;
  }> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    if (conversation.type !== 'dm') {
      throw new BadRequestException('This endpoint is for DM conversations only');
    }

    if (!conversation.participant_ids.includes(senderId)) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    const analysis = this.analyzeMessage(dto.content);
    const isProfane = this.profanityFilter.isProfane(dto.content);

    let isFlagged = false;
    let flagCategory: string | null = null;

    if (isProfane) {
      isFlagged = true;
      flagCategory = ChatMessageFlagCategory.PROFANITY;
    } else if (analysis.flags.length > 0) {
      isFlagged = true;
      flagCategory = analysis.flags[0];
    }

    const message = this.messageRepo.create({
      conversation_id: conversationId,
      sender_id: senderId,
      content: dto.content,
      is_flagged: isFlagged,
      flag_category: flagCategory,
      requires_review: analysis.requiresReview,
    });

    const saved = await this.messageRepo.save(message);

    const myIndex = conversation.participant_ids.indexOf(senderId);
    const unreadField = myIndex === 0 ? 'unread_count_rider' : 'unread_count_driver';
    await this.conversationRepo.update(conversation.id, {
      last_message: dto.content.substring(0, 500),
      last_message_sender_id: senderId,
      last_message_at: new Date().toISOString(),
      [unreadField]: () => `"${unreadField}" + 1`,
    });

    const otherParticipantIds = conversation.participant_ids.filter((id) => id !== senderId);
    otherParticipantIds.forEach((userId) => {
      this.realtimeGateway.emitConversationUpdated(userId);
    });

    return {
      message: saved,
      warning: analysis.warning,
      flagged: isFlagged,
      flag_category: flagCategory,
    };
  }

  async userHasPaidBookings(userId: string): Promise<boolean> {
    const paidStatuses = [BookingStatus.CONFIRMED, BookingStatus.EN_ROUTE, BookingStatus.COMPLETED];
    const count = await this.bookingRepo.count({
      where: [
        { rider_id: userId, status: paidStatuses[0] },
        { rider_id: userId, status: paidStatuses[1] },
        { rider_id: userId, status: paidStatuses[2] },
      ],
    });
    return count > 0;
  }

  async getGroup(
    userId: string,
    bookingId: string,
    cursor?: string,
    limit = 50,
  ): Promise<{
    conversation: any;
    participants: any[];
    messages: ChatMessage[];
    has_more: boolean;
    next_cursor?: string;
    group_state: string;
  }> {
    const conversation = await this.conversationRepo.findOne({
      where: { booking_id: bookingId },
    });
    if (!conversation) throw new NotFoundException('Group conversation not found');

    if (!conversation.participant_ids.includes(userId)) {
      throw new ForbiddenException('You are not a participant in this group');
    }

    const participantUsers = await this.userRepo.find({
      where: conversation.participant_ids.map((pid) => ({ id: pid })),
      select: ['id', 'name', 'display_name', 'selected_role'],
    });

    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip', 'trip.driver'],
    });

    const driverId = booking?.trip?.driver_id;
    const participants = participantUsers.map((u) => ({
      id: u.id,
      name: u.display_name || u.name,
      role: u.id === driverId ? 'Voyager' : 'Sailor',
    }));

    const query: any = { conversation_id: conversation.id };
    if (cursor) {
      const cursorMessage = await this.messageRepo.findOne({ where: { id: cursor } });
      if (cursorMessage) {
        query.created_at = LessThan(cursorMessage.created_at);
      }
    }

    const messages = await this.messageRepo.find({
      where: query,
      order: { created_at: 'DESC' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();
    const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1].id : undefined;

    const tripDate = booking?.trip?.departure_date;
    const now = new Date();
    let groupState = 'active';
    if (tripDate) {
      const arrivalTime = new Date(tripDate).getTime() + 48 * 3600000;
      if (now.getTime() > arrivalTime) {
        groupState = 'archived';
      }
    }

    return {
      conversation: {
        id: conversation.id,
        booking_id: conversation.booking_id,
        title: conversation.title,
        type: conversation.type,
        created_at: conversation.created_at,
        trip_details: booking?.trip
          ? {
              origin_metro: booking.trip.origin_metro,
              dest_metro: booking.trip.dest_metro,
              departure_date: booking.trip.departure_date,
              departure_time: booking.trip.departure_time,
            }
          : null,
      },
      participants,
      messages: messages.reverse(),
      has_more: hasMore,
      next_cursor: nextCursor,
      group_state: groupState,
    };
  }

  async deleteGroup(userId: string, bookingId: string): Promise<void> {
    const conversation = await this.conversationRepo.findOne({
      where: { booking_id: bookingId },
    });
    if (!conversation) throw new NotFoundException('Group conversation not found');

    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });

    const isDriver = booking?.trip?.driver_id === userId;
    if (!isDriver) {
      throw new ForbiddenException('Only the Voyager can delete this group');
    }

    await this.conversationRepo.update(conversation.id, {
      title: conversation.title,
      type: 'archived',
    });
  }

  private analyzeMessage(content: string): {
    flags: string[];
    requiresReview: boolean;
    warning?: string;
  } {
    const flags: string[] = [];
    let requiresReview = false;
    let warning: string | undefined;

    for (const [, regex] of Object.entries(CONTACT_INFO_PATTERNS)) {
      const matches = content.match(regex);
      if (matches && matches.length > 0) {
        flags.push(ChatMessageFlagCategory.CONTACT_INFO_SHARE);
        warning = 'Sharing contact info outside Bovogo violates our policies';
        break;
      }
    }

    let harassmentScore = 0;
    for (const [, regex] of Object.entries(HARASSMENT_PATTERNS)) {
      const matches = content.match(regex);
      if (matches && matches.length > 0) {
        harassmentScore++;
      }
    }

    if (harassmentScore >= 2) {
      flags.push(ChatMessageFlagCategory.HARASSMENT);
      requiresReview = true;
    }

    for (const [, regex] of Object.entries(SCAM_PATTERNS)) {
      const matches = content.match(regex);
      if (matches && matches.length > 0) {
        flags.push(ChatMessageFlagCategory.SUSPECTED_SCAM);
        requiresReview = true;
        break;
      }
    }

    return { flags, requiresReview, warning };
  }

  private async scheduleRatingRelease(
    bookingId: string,
    raterId: string,
    ratedUserId: string,
  ): Promise<void> {
    setTimeout(async () => {
      const existing = await this.ratingRepo.findOne({
        where: { booking_id: bookingId, rater_id: raterId },
      });

      if (existing && !existing.is_released) {
        const counterpart = await this.ratingRepo.findOne({
          where: { booking_id: bookingId, rater_id: ratedUserId },
        });

        if (counterpart && !counterpart.is_released) {
          await this.ratingRepo.update(existing.id, { is_released: true });
          await this.ratingRepo.update(counterpart.id, { is_released: true });

          await this.updateUserAverageRating(ratedUserId);
          await this.updateUserAverageRating(raterId);
        }
      }
    }, 72 * 3600000);
  }

  private async updateUserAverageRating(userId: string): Promise<void> {
    const ratings = await this.ratingRepo.find({
      where: { rated_user_id: userId, is_released: true },
    });

    if (ratings.length >= 5) {
      const avg = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
      const roundedAvg = Math.round(avg * 10) / 10;

      await this.userRepo.update(userId, { avg_rating: roundedAvg });
    }
  }
}
