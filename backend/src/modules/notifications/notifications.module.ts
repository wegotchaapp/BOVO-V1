import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import {
  NotificationLog,
  Device,
  NotificationPreference,
  EmergencyContact,
} from '../../database/entities/communication.entities';
import { User } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationLog,
      Device,
      NotificationPreference,
      EmergencyContact,
      User,
      Booking,
    ]),
    BullModule.registerQueue({ name: 'notifications' }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
