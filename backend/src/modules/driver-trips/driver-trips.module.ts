import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverTripsController } from './driver-trips.controller';
import { DriverTripsService } from './driver-trips.service';
import { DriverTrip } from '../../database/entities/driver-trip.entity';
import { Booking } from '../../database/entities/booking.entities';
import { Trip } from '../../database/entities/trip.entities';

@Module({
  imports: [TypeOrmModule.forFeature([DriverTrip, Booking, Trip])],
  controllers: [DriverTripsController],
  providers: [DriverTripsService],
  exports: [DriverTripsService],
})
export class DriverTripsModule {}
