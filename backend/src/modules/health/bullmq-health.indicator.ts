import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Queue } from 'bullmq';

const HEALTH_CHECK_TIMEOUT_MS = 5_000;

@Injectable()
export class BullmqHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @InjectQueue('notifications')
    private readonly notificationsQueue: Queue,
    @InjectQueue('safety-jobs') private readonly safetyQueue: Queue,
  ) {}

  async redisCheck(
    key: string,
    timeout = HEALTH_CHECK_TIMEOUT_MS,
  ): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      const client = await this.withTimeout(
        this.notificationsQueue.client,
        timeout,
      );
      await this.withTimeout(client.ping(), timeout);
      return indicator.up();
    } catch {
      return indicator.down({ message: 'Unable to reach Redis' });
    }
  }

  async bullmqCheck(
    key: string,
    timeout = HEALTH_CHECK_TIMEOUT_MS,
  ): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.withTimeout(
        Promise.all([
          this.notificationsQueue.getJobCounts('waiting', 'active', 'delayed'),
          this.safetyQueue.getJobCounts('waiting', 'active', 'delayed'),
        ]),
        timeout,
      );
      return indicator.up();
    } catch {
      return indicator.down({ message: 'Unable to reach BullMQ queues' });
    }
  }

  private async withTimeout<T>(
    operation: Promise<T>,
    timeout: number,
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('Health check timed out')),
            timeout,
          );
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
