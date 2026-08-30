import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  async check() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 10000 }),
    ]);
  }

  @Get('compliance')
  async getComplianceInfo() {
    return {
      model: 'cost-sharing-carpooling',
      description:
        'Bovogo is a cost-sharing carpooling platform. Drivers recover actual expenses only (gas, tolls, IRS mileage rate). No profit is generated from rides.',
      regulatory_status:
        'Not a TNC — exempt from Texas Occupations Code Ch. 2401+ under cost-sharing exemption',
      insurance_requirement:
        'Personal auto insurance meeting Texas minimum liability (30/60/25)',
      background_checks: 'Disabled for MVP — planned for Phase 2',
      safety_features:
        'SOS, route tracking, emergency contacts, deviation detection',
      privacy:
        'CCPA + Texas Identity Theft Act compliant — data export/deletion available at /privacy/*',
      tax: 'IRS 1099-K threshold ($600) — W-9 required before payouts exceed threshold',
      data_retention: {
        gps_pings: '90 days',
        chat_messages: '365 days or when conversation expires',
        notifications: '180 days',
        call_records: '365 days',
      },
    };
  }
}
