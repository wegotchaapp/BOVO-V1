import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { TripPing } from '../database/entities/safety.entities';
import {
  ChatConversation,
  ChatMessage,
  CallRecord,
} from '../database/entities/chat.entities';
import { NotificationLog } from '../database/entities/communication.entities';

@Injectable()
export class DataRetentionJob implements OnModuleInit {
  private readonly logger = new Logger(DataRetentionJob.name);

  private readonly PING_RETENTION_DAYS = 90;
  private readonly CHAT_RETENTION_DAYS = 365;
  private readonly NOTIF_RETENTION_DAYS = 180;
  private readonly CALL_RECORD_RETENTION_DAYS = 365;

  constructor(
    @InjectRepository(TripPing) private readonly pingRepo: Repository<TripPing>,
    @InjectRepository(ChatConversation)
    private readonly chatConvRepo: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private readonly chatMsgRepo: Repository<ChatMessage>,
    @InjectRepository(CallRecord)
    private readonly callRecordRepo: Repository<CallRecord>,
    @InjectRepository(NotificationLog)
    private readonly notifLogRepo: Repository<NotificationLog>,
  ) {}

  onModuleInit() {
    this.logger.log('DataRetentionJob initialized');
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredData(): Promise<void> {
    this.logger.log('Running data retention cleanup');

    await this.cleanupTripPings();
    await this.cleanupExpiredConversations();
    await this.cleanupOldNotifications();
    await this.cleanupOldCallRecords();
  }

  private async cleanupTripPings(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.PING_RETENTION_DAYS);

    const result = await this.pingRepo
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff: cutoff.toISOString() })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(
        `Deleted ${result.affected} trip pings older than ${this.PING_RETENTION_DAYS} days`,
      );
    }
  }

  private async cleanupExpiredConversations(): Promise<void> {
    const now = new Date();

    const expiredConvs = await this.chatConvRepo.find({
      where: { expires_at: LessThan(now.toISOString()) },
    });

    if (expiredConvs.length === 0) return;

    const convIds = expiredConvs.map((c) => c.id);

    const msgResult = await this.chatMsgRepo
      .createQueryBuilder()
      .delete()
      .where('conversation_id IN (:...convIds)', { convIds })
      .execute();

    const convResult = await this.chatConvRepo
      .createQueryBuilder()
      .delete()
      .where('expires_at < :now', { now: now.toISOString() })
      .execute();

    this.logger.log(
      `Deleted ${msgResult.affected || 0} messages and ${convResult.affected || 0} expired conversations`,
    );
  }

  private async cleanupOldNotifications(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.NOTIF_RETENTION_DAYS);

    const result = await this.notifLogRepo
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff: cutoff.toISOString() })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(
        `Deleted ${result.affected} notifications older than ${this.NOTIF_RETENTION_DAYS} days`,
      );
    }
  }

  private async cleanupOldCallRecords(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.CALL_RECORD_RETENTION_DAYS);

    const result = await this.callRecordRepo
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff: cutoff.toISOString() })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(
        `Deleted ${result.affected} call records older than ${this.CALL_RECORD_RETENTION_DAYS} days`,
      );
    }
  }
}
