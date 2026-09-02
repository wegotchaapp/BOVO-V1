function env(key: string, fallback: number): number {
  const val = process.env[key];
  return val !== undefined ? parseFloat(val) : fallback;
}

export const PRICING = {
  /**
   * IRS standard mileage rate. This is the ceiling on what a Voyager may
   * recover for a trip: total collected from Sailors must stay below
   * `miles × IRS_RATE`, otherwise the Voyager is profiting and Bovogo stops
   * looking like a cost-sharing platform.
   */
  get IRS_RATE() {
    return env('IRS_MILEAGE_RATE', 0.72);
  },

  /** Bovogo prices at 75% of the IRS ceiling to keep clear headroom. */
  get SAFETY_FACTOR() {
    return env('COST_SHARE_FACTOR', 0.75);
  },

  /**
   * Fixed divisor — the standard sedan occupancy the cost-share is split
   * across. Deliberately NOT the number of seats actually booked: the price of
   * a seat must be known before anyone books, and must not move as the car
   * fills. If fewer than three seats sell, the Voyager absorbs the difference.
   */
  STANDARD_OCCUPANCY_SEDAN: 3,

  /**
   * Flat cost-share per seat — the same on every route.
   *
   * Derived from the 180-mile reference trip:
   *   180 mi × $0.72 IRS × 75% ÷ 3 seats = $32.40
   * and then held flat, so a Sailor always knows what a seat costs and the
   * Voyager always knows what they'll recover.
   *
   * Because it does not scale with distance, the share of the IRS ceiling it
   * represents varies by route: 75% at 180 miles, ~83% at 162, and 100% at
   * 135. Below 135 miles a full car would collect MORE than the ceiling, so
   * `SAFE_FLAT_PRICE_MIN_MILES` guards that boundary.
   */
  get SEAT_PRICE() {
    return env('SEAT_PRICE', 32.4);
  },

  MIN_DISTANCE_MILES: 60,
  MAX_DISTANCE_MILES: 400,

  /**
   * Shortest route at which three seats at SEAT_PRICE still stay within the
   * IRS ceiling: 3 × $32.40 ÷ $0.72 = 135 miles. Trips below this are flagged
   * for ops review rather than blocked — pricing is unchanged, but a full car
   * on such a route recovers more than the trip actually cost.
   */
  get SAFE_FLAT_PRICE_MIN_MILES() {
    return (this.SEAT_PRICE * this.STANDARD_OCCUPANCY_SEDAN) / this.IRS_RATE;
  },

  /** Stripe US card pricing. Charged on the whole capture, our fee included. */
  STRIPE_PERCENT: 0.029,
  STRIPE_FIXED: 0.3,

  /**
   * What Bovogo intends to clear per booking after Stripe. This is the number
   * to change — the fee components below are derived from it.
   */
  get PLATFORM_TARGET_MARGIN() {
    return env('PLATFORM_TARGET_MARGIN', 2.0);
  },

  /**
   * Platform fee = PLATFORM_FEE_FIXED + PLATFORM_FEE_RATE × subtotal.
   *
   * Stripe bills 2.9% + $0.30 on the total *including this fee*, so a flat fee
   * goes underwater as bookings grow. Solving for a constant margin M:
   *
   *   fee − 0.029 × (subtotal + fee) − 0.30 = M
   *   fee = (M + 0.30)/0.971 + (0.029/0.971) × subtotal
   *
   * The rate term cancels Stripe's percentage; the fixed term covers Stripe's
   * $0.30 plus M. Net margin then holds at M for any booking size, with no
   * reliance on insurance commission.
   */
  get PLATFORM_FEE_RATE() {
    return this.STRIPE_PERCENT / (1 - this.STRIPE_PERCENT);
  },
  get PLATFORM_FEE_FIXED() {
    return (
      (this.STRIPE_FIXED + this.PLATFORM_TARGET_MARGIN) /
      (1 - this.STRIPE_PERCENT)
    );
  },

  /**
   * Trip insurance premium per seat. Provisional — the MGA terms are still
   * being negotiated, so this is env-driven and must not be hard-coded
   * anywhere else.
   */
  get INSURANCE_PREMIUM() {
    return env('INSURANCE_PREMIUM', 15.0);
  },
  get INSURANCE_COMMISSION() {
    return env('INSURANCE_COMMISSION', 0.25);
  },

  /** Luggage surcharges pass through to the Voyager in full. */
  LUGGAGE_SURCHARGE: {
    carry_on: 0,
    standard: 3,
    large: 6,
    oversized: 8,
  } as Record<string, number>,

  LUGGAGE_INSURANCE_COMMISSION: 0.2,
  LUGGAGE_INSURANCE_PREMIUMS: {
    carry_on: 0,
    standard: 3,
    large: 5,
    oversized: 8,
  } as Record<string, number>,
};

/**
 * The per-mile rate the flat price was derived from
 * (`IRS_RATE × SAFETY_FACTOR ÷ occupancy` = $0.18). Retained for the audit
 * record and the ceiling checks — it is NOT what a Sailor is charged.
 */
export function ratePerMilePerSeat(): number {
  return (
    (PRICING.IRS_RATE * PRICING.SAFETY_FACTOR) /
    PRICING.STANDARD_OCCUPANCY_SEDAN
  );
}

/**
 * Seat cost-share. Flat: every route costs the same per seat, regardless of
 * distance. `miles` is accepted only so callers read naturally and so the
 * ceiling can be evidenced alongside.
 */
export function seatPriceForMiles(_miles?: number): number {
  return PRICING.SEAT_PRICE;
}

/** The IRS ceiling for a trip — total collected must stay under this. */
export function irsCeilingForMiles(miles: number): number {
  if (!Number.isFinite(miles) || miles <= 0) return 0;
  return Math.round(miles * PRICING.IRS_RATE * 100) / 100;
}

/**
 * True when a full car at the flat price would collect more than the trip
 * actually cost to run — i.e. the cost-sharing position no longer holds.
 */
export function breachesCostShareCeiling(miles: number): boolean {
  if (!Number.isFinite(miles) || miles <= 0) return false;
  const collectedAtFullOccupancy =
    PRICING.SEAT_PRICE * PRICING.STANDARD_OCCUPANCY_SEDAN;
  return collectedAtFullOccupancy > irsCeilingForMiles(miles);
}

/** Bovogo's fee for a booking subtotal (seats + insurance + surcharges). */
export function platformFeeForSubtotal(subtotal: number): number {
  const raw =
    PRICING.PLATFORM_FEE_FIXED +
    PRICING.PLATFORM_FEE_RATE * Math.max(0, subtotal);
  return Math.round(raw * 100) / 100;
}
