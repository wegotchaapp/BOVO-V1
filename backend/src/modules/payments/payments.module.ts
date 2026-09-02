import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { StripeConnectController } from './stripe-connect.controller';
import { StripeConnectWebhookController } from './stripe-connect-webhook.controller';
import { PaymentsService } from './payments.service';
import { StripeConnectService } from './stripe-connect.service';
import { User } from '../../database/entities/user.entity';
import {
  Payment,
  Payout,
  Refund,
  InsurancePolicy,
} from '../../database/entities/payment.entities';
import { ComplianceLog } from '../../database/entities/compliance-log.entity';
import { Trip } from '../../database/entities/trip.entities';
import { Booking } from '../../database/entities/booking.entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Payment,
      Payout,
      Refund,
      ComplianceLog,
      Trip,
      Booking,
      InsurancePolicy,
    ]),
  ],
  controllers: [
    PaymentsController,
    StripeConnectController,
    StripeConnectWebhookController,
  ],
  providers: [PaymentsService, StripeConnectService],
  exports: [PaymentsService, StripeConnectService],
})
export class PaymentsModule {}
