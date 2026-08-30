import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrustSafetyController } from './trust_safety.controller';
import { TrustSafetyService } from './trust_safety.service';
import {
  Report,
  ModerationAction,
  Suspension,
  Appeal,
} from '../../database/entities/safety.entities';
import { User } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entities';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Report,
      ModerationAction,
      Suspension,
      Appeal,
      User,
      Booking,
    ]),
    NotificationsModule,
    AuditModule,
  ],
  controllers: [TrustSafetyController],
  providers: [TrustSafetyService],
  exports: [TrustSafetyService],
})
export class TrustSafetyModule {}
