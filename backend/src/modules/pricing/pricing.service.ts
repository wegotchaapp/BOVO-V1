import { Injectable } from '@nestjs/common';
import { PRICING } from './pricing.config';

export interface PricingBreakdown {
  base_seat_price: number;
  platform_fee: number;
  luggage_surcharge: number;
  insurance_premium: number;
  rider_total: number;
  driver_payout_per_seat: number;
  platform_gross_revenue: number;
  platform_net_revenue: number;
  stripe_cost: number;
}

export interface DriverPayoutInput {
  seats_booked: number;
  luggage_surcharges: { tier: string; qty: number }[];
}

export interface PlatformRevenueInput {
  total_bookings: number;
  insured_count: number;
}

@Injectable()
export class PricingService {
  calculateSeatPrice(_distanceMiles: number): number {
    return PRICING.BASE_SEAT_PRICE;
  }

  getStandardOccupancy(): number {
    return PRICING.STANDARD_OCCUPANCY_SEDAN;
  }

  getLuggageSurcharge(tier: string): number {
    return PRICING.LUGGAGE_SURCHARGE[tier] || 0;
  }

  calculateRiderTotal(distanceMiles: number, luggageTier: string, insuranceElected: boolean): number {
    const seatPrice = this.calculateSeatPrice(distanceMiles);
    const luggage = this.getLuggageSurcharge(luggageTier);
    const insurance = insuranceElected ? PRICING.INSURANCE_PREMIUM : 0;
    return seatPrice + PRICING.PLATFORM_FEE + luggage + insurance;
  }

  calculateDriverPayout(distanceMiles: number, input: DriverPayoutInput): number {
    const seatPrice = this.calculateSeatPrice(distanceMiles);
    const seatRevenue = seatPrice * input.seats_booked;
    const luggageTotal = input.luggage_surcharges.reduce(
      (sum, item) => sum + this.getLuggageSurcharge(item.tier) * item.qty,
      0,
    );
    return seatRevenue + luggageTotal;
  }

  calculatePlatformRevenue(input: PlatformRevenueInput): {
    gross: number;
    net: number;
    breakdown: { platform_fees: number; insurance_commission: number; stripe_cost: number };
  } {
    const platformFees = PRICING.PLATFORM_FEE * input.total_bookings;
    const insuranceCommission = PRICING.INSURANCE_PREMIUM * PRICING.INSURANCE_COMMISSION * input.insured_count;
    const gross = platformFees + insuranceCommission;
    const stripeCost = 0.029 * gross + 0.30 * input.total_bookings;
    return {
      gross: Math.round(gross * 100) / 100,
      net: Math.round((gross - stripeCost) * 100) / 100,
      breakdown: {
        platform_fees: platformFees,
        insurance_commission: Math.round(insuranceCommission * 100) / 100,
        stripe_cost: Math.round(stripeCost * 100) / 100,
      },
    };
  }

  getFullPricingBreakdown(distanceMiles: number, luggageTier: string, insuranceElected: boolean): PricingBreakdown {
    const base_seat_price = this.calculateSeatPrice(distanceMiles);
    const luggage_surcharge = this.getLuggageSurcharge(luggageTier);
    const insurance_premium = insuranceElected ? PRICING.INSURANCE_PREMIUM : 0;
    const rider_total = base_seat_price + PRICING.PLATFORM_FEE + luggage_surcharge + insurance_premium;
    const grossRev = PRICING.PLATFORM_FEE + (insuranceElected ? PRICING.INSURANCE_PREMIUM * PRICING.INSURANCE_COMMISSION : 0);
    const stripeCost = 0.029 * PRICING.PLATFORM_FEE + 0.30;

    return {
      base_seat_price,
      platform_fee: PRICING.PLATFORM_FEE,
      luggage_surcharge,
      insurance_premium,
      rider_total,
      driver_payout_per_seat: base_seat_price,
      platform_gross_revenue: Math.round(grossRev * 100) / 100,
      platform_net_revenue: Math.round((grossRev - stripeCost) * 100) / 100,
      stripe_cost: Math.round(stripeCost * 100) / 100,
    };
  }
}
