import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { PreferencesService } from './preferences.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}
