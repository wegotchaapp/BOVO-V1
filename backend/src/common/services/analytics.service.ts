import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class AnalyticsService {
  constructor(private readonly logger: PinoLogger) {}

  track(userId: string, event: string, properties?: Record<string, unknown>): void {
    this.logger.info({ userId, event, properties }, `[Analytics] ${event}`);
  }
}