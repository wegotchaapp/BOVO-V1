import { Module } from '@nestjs/common';
import { InsuranceService } from './insurance.service';

@Module({
  providers: [InsuranceService],
  exports: [InsuranceService],
})
export class InsuranceModule {}
