import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataRetentionJob } from '../../jobs/data-retention.job';
import { RetentionProcessor } from './retention.processor';
import { PrivacyModule } from '../privacy/privacy.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { TripPing, SosEvent, Incident, DeviationEvent } from '../../database/entities/safety.entities';
import { ChatConversation, ChatMessage, CallRecord } from '../../database/entities/chat.entities';
import { NotificationLog } from '../../database/entities/communication.entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TripPing, SosEvent, Incident, DeviationEvent,
      ChatConversation, ChatMessage, CallRecord,
      NotificationLog,
    ]),
    PrivacyModule,
    ComplianceModule,
  ],
  providers: [DataRetentionJob, RetentionProcessor],
  exports: [DataRetentionJob, RetentionProcessor],
})
export class DataRetentionModule {}
