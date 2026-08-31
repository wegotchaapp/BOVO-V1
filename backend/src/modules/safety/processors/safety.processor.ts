import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { SafetyService } from '../safety.service';

@Processor('safety-jobs')
@Injectable()
export class SafetyJobProcessor extends WorkerHost {
  constructor(
    private readonly safetyService: SafetyService,
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.info(
      { jobName: job.name, jobId: job.id },
      'Processing safety job',
    );

    switch (job.name) {
      case 'check-trip-overruns':
        await this.safetyService.checkTripOverruns();
        return { completed: true };
      default:
        this.logger.warn({ jobName: job.name }, 'Unknown safety job');
    }
  }
}
