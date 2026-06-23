import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripGroupsController } from './trip-groups.controller';
import { TripGroupsService } from './trip-groups.service';
import {
  TripGroup,
  TripGroupMember,
  TripGroupMessage,
  TripGroupPickupApproval,
} from '../../database/entities/trip-group.entity';
import { Booking } from '../../database/entities/booking.entities';

@Module({
  imports: [TypeOrmModule.forFeature([TripGroup, TripGroupMember, TripGroupMessage, TripGroupPickupApproval, Booking])],
  controllers: [TripGroupsController],
  providers: [TripGroupsService],
  exports: [TripGroupsService],
})
export class TripGroupsModule {}
