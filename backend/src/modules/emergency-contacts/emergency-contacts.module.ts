import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyContactsController } from './emergency-contacts.controller';
import { TwilioWebhookController } from './twilio-webhook.controller';
import { EmergencyContactsService } from '../auth/emergency-contacts.service';
import { EmergencyContact } from '../../database/entities/communication.entities';

@Module({
  imports: [TypeOrmModule.forFeature([EmergencyContact])],
  controllers: [EmergencyContactsController, TwilioWebhookController],
  providers: [EmergencyContactsService],
  exports: [EmergencyContactsService],
})
export class EmergencyContactsModule {}
