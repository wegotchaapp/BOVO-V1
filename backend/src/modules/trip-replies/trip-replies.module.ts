import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripRepliesController } from './trip-replies.controller';
import { TripRepliesService } from './trip-replies.service';
import {
  TripReply,
  TripReplyRead,
} from '../../database/entities/trip-reply.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TripReply, TripReplyRead])],
  controllers: [TripRepliesController],
  providers: [TripRepliesService],
  exports: [TripRepliesService],
})
export class TripRepliesModule {}
