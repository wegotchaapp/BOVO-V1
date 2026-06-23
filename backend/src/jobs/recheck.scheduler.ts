import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CheckrService } from '../modules/identity/checkr.service';
import { RECHECK_QUEUE } from './recheck.processor';

@Injectable()
export class RecheckScheduler implements OnModuleInit {
  private readonly logger = new Logger(RecheckScheduler.name);

  constructor(
    private readonly checkrService: CheckrService,
    @InjectQueue(RECHECK_QUEUE)
    private readonly recheckQueue: Queue,
  ) {}

  onModuleInit() {
    this.logger.log('RecheckScheduler initialized');
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async scheduleDueRechecks(): Promise<void> {
    this.logger.log('Running daily re-check scheduler');

    const checksDue = await this.checkrService.getChecksDueForRecheck();

    if (checksDue.length === 0) {
      this.logger.log('No background checks due for re-check');
      return;
    }

    this.logger.log(`Found ${checksDue.length} checks due for re-check`);

    for (const check of checksDue) {
      try {
        await this.recheckQueue.add(
          'recheck',
          {
            userId: check.user_id,
            bgCheckId: check.id,
            candidateId: check.checkr_candidate_id,
          },
          {
            delay: this.calculateDelay(check.user_id),
          },
        );

        this.logger.log(
          `Re-check job queued for user ${check.user_id}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to queue re-check for user ${check.user_id}: ${error}`,
        );
      }
    }
  }

  private calculateDelay(userId: string): number {
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const staggerMs = (hash % 7) * 24 * 60 * 60 * 1000;
    return staggerMs;
  }
}
