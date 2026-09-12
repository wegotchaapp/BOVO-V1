import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrivateMediaService } from './private-media.service';

@Module({
  imports: [ConfigModule],
  providers: [PrivateMediaService],
  exports: [PrivateMediaService],
})
export class PrivateMediaModule {}
