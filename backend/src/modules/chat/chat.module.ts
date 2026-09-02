import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChatConversation,
  ChatMessage,
  ChatBlock,
  CallRecord,
} from '../../database/entities/chat.entities';
import { Booking } from '../../database/entities/booking.entities';
import { User } from '../../database/entities/user.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatConversation,
      ChatMessage,
      ChatBlock,
      CallRecord,
      Booking,
      User,
    ]),
    NotificationsModule,
    AuditModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
