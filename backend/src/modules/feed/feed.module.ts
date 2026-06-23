import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedController, PostController } from './feed.controller';
import { FeedService } from './feed.service';
import { Trip, TripPreference, TripZone } from '../../database/entities/trip.entities';
import { User } from '../../database/entities/user.entity';
import { Booking } from '../../database/entities/booking.entities';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, TripPreference, TripZone, User, Booking])],
  controllers: [FeedController, PostController],
  providers: [FeedService],
})
export class FeedModule {}
