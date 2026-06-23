import { Module } from '@nestjs/common';
import { LuggageService } from './luggage.service';

@Module({
  providers: [LuggageService],
  exports: [LuggageService],
})
export class LuggageModule {}
