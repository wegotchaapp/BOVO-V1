import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { User } from '../../database/entities/user.entity';
import { Trip } from '../../database/entities/trip.entities';
import { Booking } from '../../database/entities/booking.entities';
import { Payment, Payout } from '../../database/entities/payment.entities';
import { SosEvent, Incident } from '../../database/entities/safety.entities';
import { Vehicle } from '../../database/entities/profile.entities';
import { AuditEvent } from '../../database/entities/audit.entity';
import { SupportTicket } from '../../database/entities/support-ticket.entity';
import { SupportTicketMessage } from '../../database/entities/support-ticket-message.entity';
import { SupportAgent } from '../../database/entities/support-agent.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import {
  MobileUser,
  MobileVehicle,
} from '../mobile-api/entities/mobile.entities';

/**
 * Minimal admin module backing the Bovogo admin dashboard's /admin/* endpoints.
 * Reconstructed because the upstream Wegotcha repo referenced but did not
 * include this module's source.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([
      User,
      Trip,
      Booking,
      Payment,
      Payout,
      SosEvent,
      Incident,
      Vehicle,
      MobileVehicle,
      MobileUser,
      AuditEvent,
      SupportTicket,
      SupportTicketMessage,
      SupportAgent,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
