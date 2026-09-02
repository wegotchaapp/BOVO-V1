import {
  PRICING,
  platformFeeForSubtotal,
  ratePerMilePerSeat,
  seatPriceForMiles,
} from '../pricing/pricing.config';

/**
 * Pricing for the mobile `/api/*` layer.
 *
 * The seat price is computed here, server-side, from the route — never taken
 * from the client. A Voyager must not be able to name their own price: the
 * cost-sharing position depends on every seat being provably at 75% of the IRS
 * ceiling, and a client-supplied figure carries no such guarantee.
 */

/**
 * Driving distances between served cities (miles). Mirrors the table in the
 * mobile app's lib/pricing.ts; the server value is the authoritative one.
 */
const DISTANCE_TABLE: Record<string, Record<string, number>> = {
  'Dallas, TX': {
    'Austin, TX': 195,
    'Houston, TX': 239,
    'San Antonio, TX': 272,
    'Fort Worth, TX': 35,
    'El Paso, TX': 635,
    'Waco, TX': 99,
    'Plano, TX': 20,
    'Lubbock, TX': 318,
    'Corpus Christi, TX': 388,
    'Arlington, TX': 21,
    'Amarillo, TX': 362,
    'Bentonville, AR': 330,
  },
  'Austin, TX': {
    'Dallas, TX': 195,
    'Houston, TX': 162,
    'San Antonio, TX': 79,
    'Fort Worth, TX': 190,
    'El Paso, TX': 575,
    'Waco, TX': 102,
    'Plano, TX': 215,
    'Lubbock, TX': 380,
    'Corpus Christi, TX': 217,
    'Arlington, TX': 195,
    'Amarillo, TX': 487,
    'Bentonville, AR': 525,
  },
  'Houston, TX': {
    'Dallas, TX': 239,
    'Austin, TX': 162,
    'San Antonio, TX': 197,
    'Fort Worth, TX': 263,
    'El Paso, TX': 745,
    'Waco, TX': 184,
    'Plano, TX': 261,
    'Lubbock, TX': 506,
    'Corpus Christi, TX': 211,
    'Arlington, TX': 257,
    'Amarillo, TX': 596,
    'Bentonville, AR': 570,
  },
  'San Antonio, TX': {
    'Dallas, TX': 272,
    'Austin, TX': 79,
    'Houston, TX': 197,
    'Fort Worth, TX': 264,
    'El Paso, TX': 553,
    'Waco, TX': 178,
    'Plano, TX': 287,
    'Lubbock, TX': 410,
    'Corpus Christi, TX': 145,
    'Arlington, TX': 263,
    'Amarillo, TX': 510,
    'Bentonville, AR': 600,
  },
  'Fort Worth, TX': {
    'Dallas, TX': 35,
    'Austin, TX': 190,
    'Houston, TX': 263,
    'San Antonio, TX': 264,
    'El Paso, TX': 600,
    'Waco, TX': 90,
    'Plano, TX': 41,
    'Lubbock, TX': 320,
    'Corpus Christi, TX': 410,
    'Arlington, TX': 12,
    'Amarillo, TX': 345,
    'Bentonville, AR': 350,
  },
};

/** Used when a route isn't tabulated — deliberately conservative. */
const DEFAULT_DISTANCE_MILES = 150;

export function distanceBetween(from: string, to: string): number {
  if (!from || !to || from === to) return 0;
  return (
    DISTANCE_TABLE[from]?.[to] ??
    DISTANCE_TABLE[to]?.[from] ??
    DEFAULT_DISTANCE_MILES
  );
}

/** Authoritative cost-share for one seat on a route. */
export function seatPriceForRoute(from: string, to: string): number {
  return seatPriceForMiles(distanceBetween(from, to));
}

/** Bovogo's fee for a booking subtotal (seats + insurance + surcharges). */
export function feeForSubtotal(subtotal: number): number {
  return platformFeeForSubtotal(subtotal);
}

export const LUGGAGE_TIERS = [
  'carry_on',
  'standard',
  'large',
  'oversized',
] as const;
export type LuggageTier = (typeof LUGGAGE_TIERS)[number];

export function isLuggageTier(v: unknown): v is LuggageTier {
  return (
    typeof v === 'string' && (LUGGAGE_TIERS as readonly string[]).includes(v)
  );
}

/**
 * Luggage surcharge — compensates the Voyager for the extra fuel and the trunk
 * space given up. Passes to them in full: Bovogo retains nothing from the
 * surcharge itself, only from the optional luggage insurance below.
 */
export function luggageSurcharge(tier: LuggageTier): number {
  return PRICING.LUGGAGE_SURCHARGE[tier] ?? 0;
}

/** Optional luggage cover. Bovogo's commission is a cut of this, not the surcharge. */
export function luggageInsurancePremium(tier: LuggageTier): number {
  return PRICING.LUGGAGE_INSURANCE_PREMIUMS[tier] ?? 0;
}

export interface BookingPriceInput {
  pricePerSeat: number;
  seats: number;
  luggageTier: LuggageTier;
  /** Trip insurance is default-on; the Sailor must actively decline it. */
  insuranceOptedIn: boolean;
  luggageInsuranceOptedIn: boolean;
}

export interface BookingPriceBreakdown {
  pricePerSeat: number;
  seatSubtotal: number;
  luggageTier: LuggageTier;
  luggageSurcharge: number;
  insurancePremium: number;
  luggageInsurancePremium: number;
  subtotal: number;
  serviceFee: number;
  totalAmount: number;
  /** What the Voyager receives: seat cost-share + the full luggage surcharge. */
  voyagerPayout: number;
  /** Bovogo's gross: service fee + both insurance commissions. */
  platformGross: number;
}

/**
 * Single place the money for a booking is worked out. Both the paid path and
 * the no-Stripe fallback go through here so they cannot drift apart.
 */
export function priceBooking(input: BookingPriceInput): BookingPriceBreakdown {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const seatSubtotal = round2(input.pricePerSeat * input.seats);
  // Surcharge and cover are declared per booking, not per seat.
  const surcharge = input.luggageTier ? luggageSurcharge(input.luggageTier) : 0;
  const insurance = input.insuranceOptedIn
    ? round2(PRICING.INSURANCE_PREMIUM * input.seats)
    : 0;
  const luggageInsurance = input.luggageInsuranceOptedIn
    ? luggageInsurancePremium(input.luggageTier)
    : 0;

  const subtotal = round2(
    seatSubtotal + surcharge + insurance + luggageInsurance,
  );
  const serviceFee = platformFeeForSubtotal(subtotal);
  const totalAmount = round2(subtotal + serviceFee);

  return {
    pricePerSeat: input.pricePerSeat,
    seatSubtotal,
    luggageTier: input.luggageTier,
    luggageSurcharge: surcharge,
    insurancePremium: insurance,
    luggageInsurancePremium: luggageInsurance,
    subtotal,
    serviceFee,
    totalAmount,
    voyagerPayout: round2(seatSubtotal + surcharge),
    platformGross: round2(
      serviceFee +
        insurance * PRICING.INSURANCE_COMMISSION +
        luggageInsurance * PRICING.LUGGAGE_INSURANCE_COMMISSION,
    ),
  };
}

/**
 * Full breakdown for a route, for display and for the audit record. Includes
 * the IRS ceiling so the cost-share position is evidenced on every trip.
 */
export function routePricing(from: string, to: string) {
  const miles = distanceBetween(from, to);
  const perSeat = seatPriceForMiles(miles);
  const occupancy = PRICING.STANDARD_OCCUPANCY_SEDAN;
  return {
    miles,
    perSeat,
    ratePerMilePerSeat: Math.round(ratePerMilePerSeat() * 10000) / 10000,
    irsRate: PRICING.IRS_RATE,
    costShareFactor: PRICING.SAFETY_FACTOR,
    standardOccupancy: occupancy,
    irsCeilingForTrip: Math.round(miles * PRICING.IRS_RATE * 100) / 100,
    maxCollectedAtFullOccupancy: Math.round(perSeat * occupancy * 100) / 100,
  };
}
