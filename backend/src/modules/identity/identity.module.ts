import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdentityController } from './identity.controller';
import { IdentityWebhookController } from './identity-webhook.controller';
import { BackgroundCheckController } from './background-check.controller';
import { CheckrWebhookController } from './checkr-webhook.controller';
import { IdentityService } from './identity.service';
import { CheckrService } from './checkr.service';
import { AdverseActionService } from './adverse-action.service';
import { Verification, BackgroundCheck } from '../../database/entities/identity.entities';
import { User } from '../../database/entities/user.entity';
import { Incident } from '../../database/entities/safety.entities';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Verification, BackgroundCheck, User, Incident]),
    AuditModule,
  ],
  controllers: [
    IdentityController,
    IdentityWebhookController,
    BackgroundCheckController,
    CheckrWebhookController,
  ],
  providers: [
    IdentityService,
    CheckrService,
    AdverseActionService,
  ],
  exports: [IdentityService, CheckrService],
})
export class IdentityModule {}