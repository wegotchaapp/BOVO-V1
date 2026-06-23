import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesController } from './profiles.controller';
import { UserController } from './user.controller';
import { ProfilesService } from './profiles.service';
import { Profile, Vehicle } from '../../database/entities/profile.entities';
import { User } from '../../database/entities/user.entity';
import { Verification } from '../../database/entities/identity.entities';
import { Trip } from '../../database/entities/trip.entities';
import { Booking } from '../../database/entities/booking.entities';
import { Payout } from '../../database/entities/payment.entities';

@Module({
  imports: [TypeOrmModule.forFeature([Profile, Vehicle, User, Verification, Trip, Booking, Payout])],
  controllers: [ProfilesController, UserController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
