import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackgroundCheck } from '../database/entities/identity.entities';
import { AdverseActionService } from '../modules/identity/adverse-action.service';

@Injectable()
export class AdverseActionScheduler implements OnModuleInit {
  private readonly logger = new Logger(AdverseActionScheduler.name);

  constructor(
    @InjectRepository(BackgroundCheck)
    private readonly bgCheckRepo: Repository<BackgroundCheck>,
    private readonly adverseActionService: AdverseActionService,
  ) {}

  onModuleInit() {
    this.logger.log('AdverseActionScheduler initialized');
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processDueAdverseNotices(): Promise<void> {
    this.logger.log('Checking for adverse action notices due');

    const now = new Date().toISOString();

    const dueChecks = await this.bgCheckRepo
      .createQueryBuilder('bg')
      .where('bg.status = :status', { status: 'adverse' })
      .andWhere('bg.adverse_action_deadline <= :now', { now })
      .andWhere('bg.final_adverse_notice_sent_at IS NULL')
      .leftJoinAndSelect('bg.user', 'user')
      .getMany();

    if (dueChecks.length === 0) {
      this.logger.log('No adverse action notices due');
      return;
    }

    this.logger.log(`Processing ${dueChecks.length} final adverse notices`);

    for (const check of dueChecks) {
      try {
        await this.adverseActionService.sendFinalAdverseNotice(
          check.user,
          check.id,
          check.checkr_candidate_id,
        );

        check.final_adverse_notice_sent_at = new Date().toISOString();
        await this.bgCheckRepo.save(check);

        this.logger.log(
          `Final adverse notice sent for user ${check.user_id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send final adverse notice for user ${check.user_id}: ${error}`,
        );
      }
    }
  }
}
