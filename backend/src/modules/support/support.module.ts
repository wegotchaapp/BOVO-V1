import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportAgent } from '../../database/entities/support-agent.entity';
import { SupportTicket } from '../../database/entities/support-ticket.entity';
import { SupportTicketMessage } from '../../database/entities/support-ticket-message.entity';
import { SupportSession } from '../../database/entities/support-session.entity';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SupportAuthGuard } from './support-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportAgent, SupportTicket, SupportTicketMessage, SupportSession]),
  ],
  controllers: [SupportController],
  providers: [SupportService, SupportAuthGuard],
  exports: [SupportService],
})
export class SupportModule {}
