import { Module } from '@nestjs/common';
import { NoonlightService } from './noonlight.service';

/**
 * Standalone so both SafetyModule and MobileApiModule can import it without
 * either depending on the other.
 */
@Module({
  providers: [NoonlightService],
  exports: [NoonlightService],
})
export class NoonlightModule {}
