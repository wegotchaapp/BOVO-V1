import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { TripReply, TripReplyRead } from '../../database/entities/trip-reply.entity';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class TripRepliesService {
  constructor(
    @InjectRepository(TripReply)
    private readonly replyRepo: Repository<TripReply>,
    @InjectRepository(TripReplyRead)
    private readonly readRepo: Repository<TripReplyRead>,
    private readonly logger: PinoLogger,
  ) {}

  async createReply(tripId: string, userId: string, text: string): Promise<TripReply> {
    const reply = this.replyRepo.create({
      id: uuidv4().replace(/-/g, '').slice(0, 32),
      trip_id: tripId,
      user_id: userId,
      text,
    });
    const saved = await this.replyRepo.save(reply);
    this.logger.info({ tripId, userId, replyId: saved.id }, 'Trip reply created');
    return saved;
  }

  async getReplies(tripId: string): Promise<any[]> {
    const replies = await this.replyRepo.find({
      where: { trip_id: tripId },
      order: { created_at: 'ASC' },
    });
    return replies;
  }

  async markRead(replyId: string, userId: string): Promise<void> {
    const reply = await this.replyRepo.findOne({ where: { id: replyId } });
    if (!reply) throw new NotFoundException('Reply not found');

    const existing = await this.readRepo.findOne({
      where: { reply_id: replyId, user_id: userId },
    });
    if (existing) return;

    const readEntry = this.readRepo.create({
      id: uuidv4().replace(/-/g, '').slice(0, 32),
      reply_id: replyId,
      user_id: userId,
    });
    await this.readRepo.save(readEntry);
    this.logger.info({ replyId, userId }, 'Trip reply marked as read');
  }
}
