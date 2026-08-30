import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { BackgroundCheck } from '../database/entities/identity.entities';
import { User } from '../database/entities/user.entity';
import { BackgroundCheckStatus } from '../common/enums';

export const RECHECK_QUEUE = 'background-check-recheck';

interface RecheckJobData {
  userId: string;
  bgCheckId: string;
  candidateId: string;
}

@Processor(RECHECK_QUEUE)
@Injectable()
export class RecheckJobProcessor extends WorkerHost {
  private readonly logger = new Logger(RecheckJobProcessor.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.checkr.com/v1';

  constructor(
    @InjectRepository(BackgroundCheck)
    private readonly bgCheckRepo: Repository<BackgroundCheck>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {
    super();
    this.apiKey = this.config.get<string>('CHECKR_API_KEY') || '';
  }

  async process(job: Job<RecheckJobData, any, string>): Promise<any> {
    const { userId, bgCheckId, candidateId } = job.data;

    this.logger.log(`Processing re-check job ${job.id} for user ${userId}`);

    try {
      const invitation = await this.createRecheckInvitation(candidateId);

      const bgCheck = await this.bgCheckRepo.findOne({
        where: { id: bgCheckId },
      });

      if (bgCheck) {
        bgCheck.invitation_url = invitation.invitation_url;
        bgCheck.status = BackgroundCheckStatus.PENDING;
        bgCheck.completed_at = null;
        bgCheck.annual_recheck_scheduled = false;
        await this.bgCheckRepo.save(bgCheck);

        await this.userRepo.update(userId, {
          background_check_status: 'pending_recheck',
        });

        this.logger.log(
          `Re-check initiated for user ${userId}, invitation URL sent`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process re-check job for user ${userId}: ${error}`,
      );
      throw error;
    }
  }

  private async createRecheckInvitation(
    candidateId: string,
  ): Promise<{ id: string; invitation_url: string }> {
    const response = await fetch(`${this.baseUrl}/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidate_id: candidateId,
        package: 'driver_pro',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        `Checkr API error: ${error.error?.message || 'Unknown error'}`,
      );
    }

    return response.json();
  }
}
