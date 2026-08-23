import { Module } from '@nestjs/common';
import { RoutingService } from './routing.service';

/** Standalone so both the platform and mobile safety paths can import it. */
@Module({
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
