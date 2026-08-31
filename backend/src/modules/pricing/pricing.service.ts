import { Injectable } from '@nestjs/common';
import {
  PRICING,
  platformFeeForSubtotal,
  seatPriceForMiles,
} from './pricing.config';

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
  /** Average pre-fee subtotal per booking; fees scale with it. */
  avg_subtotal?: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class PricingService {
  /**
   * Cost-share per seat for a route: miles × $0.72 × 75% ÷ 3 seats.
   * Distance-based at every length, so the total collected is always exactly
   * 75% of the IRS ceiling — never above it on short routes, and it still
   * recovers properly on long ones.
   */
  calculateSeatPrice(distanceMiles: number): number {
    return seatPriceForMiles(distanceMiles);
  }

  /** Bovogo's fee on a booking subtotal. */
  calculatePlatformFee(subtotal: number): number {
    return platformFeeForSubtotal(subtotal);
  }

  getStandardOccupancy(): number {
    return PRICING.STANDARD_OCCUPANCY_SEDAN;
  }

  getLuggageSurcharge(tier: string): number {
    return PRICING.LUGGAGE_SURCHARGE[tier] || 0;
  }

  calculateRiderTotal(
    distanceMiles: number,
    luggageTier: string,
    insuranceElected: boolean,
  ): number {
    const seatPrice = this.calculateSeatPrice(distanceMiles);
    const luggage = this.getLuggageSurcharge(luggageTier);
    const insurance = insuranceElected ? PRICING.INSURANCE_PREMIUM : 0;
    const subtotal = seatPrice + luggage + insurance;
    return round2(subtotal + this.calculatePlatformFee(subtotal));
  }

  calculateDriverPayout(
    distanceMiles: number,
    input: DriverPayoutInput,
  ): number {
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
    breakdown: {
      platform_fees: number;
      insurance_commission: number;
      stripe_cost: number;
    };
  } {
    // Fees now scale with booking size, so an average subtotal is needed to
    // estimate them in aggregate.
    const avgSubtotal = input.avg_subtotal ?? 0;
    const platformFees =
      platformFeeForSubtotal(avgSubtotal) * input.total_bookings;
    const insuranceCommission =
      PRICING.INSURANCE_PREMIUM *
      PRICING.INSURANCE_COMMISSION *
      input.insured_count;
    const gross = platformFees + insuranceCommission;
    const stripeCost =
      PRICING.STRIPE_PERCENT *
        (avgSubtotal * input.total_bookings + platformFees) +
      PRICING.STRIPE_FIXED * input.total_bookings;
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

  getFullPricingBreakdown(
    distanceMiles: number,
    luggageTier: string,
    insuranceElected: boolean,
  ): PricingBreakdown {
    const base_seat_price = this.calculateSeatPrice(distanceMiles);
    const luggage_surcharge = this.getLuggageSurcharge(luggageTier);
    const insurance_premium = insuranceElected ? PRICING.INSURANCE_PREMIUM : 0;
    const subtotal = base_seat_price + luggage_surcharge + insurance_premium;
    const platform_fee = platformFeeForSubtotal(subtotal);
    const rider_total = round2(subtotal + platform_fee);
    const grossRev =
      platform_fee +
      (insuranceElected
        ? PRICING.INSURANCE_PREMIUM * PRICING.INSURANCE_COMMISSION
        : 0);
    // Stripe bills on the full captured amount, this fee included.
    const stripeCost =
      PRICING.STRIPE_PERCENT * rider_total + PRICING.STRIPE_FIXED;

    return {
      base_seat_price,
      platform_fee,
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
