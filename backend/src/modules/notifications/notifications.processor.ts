import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationsService } from './notifications.service';
import { PinoLogger } from 'nestjs-pino';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job) {
    this.logger.setContext(NotificationsProcessor.name);

    if (job.name === 'deliver') {
      this.logger.info(
        { jobId: job.id, channel: job.data.channel, category: job.data.category },
        'Processing notification delivery',
      );
      await this.notificationsService.processNotificationJob(job);
    } else if (job.name === 'reminder') {
      this.logger.info(
        { jobId: job.id, type: job.data.type, bookingId: job.data.bookingId },
        'Processing reminder notification',
      );
      await this.notificationsService.processReminderJob(job);
    }
  }
}
