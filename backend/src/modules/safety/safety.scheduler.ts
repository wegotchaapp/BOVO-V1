import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class SafetyScheduler {
  constructor(
    @InjectQueue('safety-jobs')
    private readonly safetyQueue: Queue,
    private readonly logger: PinoLogger,
  ) {}

  @Cron('0 */15 * * * *')
  async scheduleOverrunCheck() {
    this.logger.info('Scheduling trip overrun check');
    await this.safetyQueue.add(
      'check-trip-overruns',
      {},
      {
        removeOnComplete: true,
        removeOnFail: { age: 86400 },
      },
    );
  }
}
