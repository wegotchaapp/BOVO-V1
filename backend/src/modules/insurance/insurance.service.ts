import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class InsuranceService {
  private readonly mgaApiUrl: string | null;
  private readonly mgaApiKey: string | null;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.mgaApiUrl = this.config.get<string>('MGA_API_URL') || null;
    this.mgaApiKey = this.config.get<string>('MGA_API_KEY') || null;
  }

  async activatePolicy(bookingId: string, userId: string): Promise<any> {
    if (this.mgaApiUrl && this.mgaApiKey) {
      try {
        const response = await fetch(`${this.mgaApiUrl}/policies/activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.mgaApiKey}`,
          },
          body: JSON.stringify({ bookingId, userId }),
        });
        if (!response.ok) {
          throw new Error(`MGA API returned ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        this.logger.error({ bookingId, userId, error }, 'MGA policy activation failed');
        throw new InternalServerErrorException('Insurance policy activation failed');
      }
    }

    this.logger.info({ bookingId, userId }, 'Insurance policy activated (mock)');
    return { policy_number: `WG-INS-${Date.now()}`, status: 'active', provider: 'mock' };
  }

  async deactivatePolicy(bookingId: string): Promise<void> {
    if (this.mgaApiUrl && this.mgaApiKey) {
      try {
        const response = await fetch(`${this.mgaApiUrl}/policies/deactivate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.mgaApiKey}`,
          },
          body: JSON.stringify({ bookingId }),
        });
        if (!response.ok) {
          throw new Error(`MGA API returned ${response.status}`);
        }
        return;
      } catch (error) {
        this.logger.error({ bookingId, error }, 'MGA policy deactivation failed');
        throw new InternalServerErrorException('Insurance policy deactivation failed');
      }
    }

    this.logger.info({ bookingId }, 'Insurance policy deactivated (mock)');
  }

  calculatePremium(riderAge: number, tripDistance: number): number {
    if (this.mgaApiKey) {
      return Math.round(500 + tripDistance * 2 + (riderAge < 25 ? 200 : 0));
    }
    return 500;
  }
}
