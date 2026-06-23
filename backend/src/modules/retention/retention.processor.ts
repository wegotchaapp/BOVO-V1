import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrivacyService } from '../privacy/privacy.service';
import { ComplianceService } from '../compliance/compliance.service';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class RetentionProcessor {
  constructor(
    private readonly privacyService: PrivacyService,
    private readonly complianceService: ComplianceService,
    private readonly logger: PinoLogger,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processScheduledDeletions() {
    this.logger.info('Running scheduled deletion processor');

    try {
      const deletedCount = await this.privacyService.processScheduledDeletions();
      if (deletedCount > 0) {
        this.logger.info({ deletedCount }, 'Scheduled deletions processed');
      }
    } catch (err) {
      this.logger.error({ err }, 'Failed to process scheduled deletions');
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async logRetentionCompliance() {
    this.logger.info('Running daily retention compliance check');

    try {
      await this.complianceService.log(
        'system',
        'DATA_RETENTION',
        'daily_retention_check',
        'Automated daily retention compliance check completed',
      );
      this.logger.info('Daily retention compliance logged');
    } catch (err) {
      this.logger.error({ err }, 'Failed to log retention compliance');
    }
  }
}
