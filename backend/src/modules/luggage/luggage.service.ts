import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class LuggageService {
  constructor(private readonly logger: PinoLogger) {}

  getLuggageSpecs(type: string): any {
    const specs: Record<string, any> = {
      carry_on: {
        max_weight_kg: 10,
        max_dimensions_cm: [56, 36, 23],
        cost_contribution: 0,
      },
      small_bag: {
        max_weight_kg: 15,
        max_dimensions_cm: [60, 40, 30],
        cost_contribution: 3,
      },
      large_bag: {
        max_weight_kg: 23,
        max_dimensions_cm: [75, 50, 35],
        cost_contribution: 5,
      },
      special: {
        max_weight_kg: 30,
        max_dimensions_cm: [100, 60, 50],
        cost_contribution: 10,
      },
    };
    return specs[type] || null;
  }

  checkCompatibility(vehicleCategory: string, luggageItems: any[]): boolean {
    // TODO: implement vehicle category to luggage capacity mapping
    return true;
  }

  calculateLuggageContribution(items: any[]): number {
    return items.reduce((sum, item) => {
      const spec = this.getLuggageSpecs(item.type);
      return sum + (spec?.cost_contribution || 0) * item.qty;
    }, 0);
  }
}
