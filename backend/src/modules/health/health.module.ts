import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TerminusModule } from '@nestjs/terminus';
import { BullmqHealthIndicator } from './bullmq-health.indicator';
import { HealthController } from './health.controller';

@Module({
  imports: [
    TerminusModule,
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'safety-jobs' },
    ),
  ],
  controllers: [HealthController],
  providers: [BullmqHealthIndicator],
})
export class HealthModule {}
