import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import {
  Trip,
  TripPreference,
  TripZone,
  TripReply,
} from '../../database/entities/trip.entities';
import { Booking } from '../../database/entities/booking.entities';
import { Vehicle } from '../../database/entities/profile.entities';
import { User } from '../../database/entities/user.entity';
import { SavedSearch } from '../../database/entities/saved-search.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Trip,
      TripPreference,
      TripZone,
      TripReply,
      Booking,
      Vehicle,
      User,
      SavedSearch,
    ]),
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
