/**
 * Bovogo's booking quote — the authoritative one.
 *
 * Every figure here is an integer number of cents, computed server-side from
 * the adventure's *measured* route distance. No amount, distance or fare is
 * ever read off a request body: a Sailor who edits the JSON changes nothing,
 * and a Voyager cannot name their own price.
 *
 * Kept out of `modules/pricing/pricing.config.ts` deliberately. That file holds
 * the v1 flat-price constants and the insurance premiums, and every booking
 * taken before this model existed still resolves through it. Changing it would
 * rewrite history; adding beside it does not.
 */

/** Version for the clarified fixed-three-seat formula; preserve older snapshots. */
export const QUOTE_VERSION = 'v4-mileage-fixed-three-2026-09';

/** Fixed formula: ($0.54 × dynamic miles) ÷ 3 per human fare unit.
 * The divisor stays three regardless of actual passenger count.
 * 180 miles = $32.40; 200 miles = $36.00, before fees.
 */
export const BASE_RATE_CENTS_PER_MILE = 54;
export const FIXED_AVERAGE_SEATS = 3;
export const RIDER_RATE_CENTS_PER_MILE =
  BASE_RATE_CENTS_PER_MILE / FIXED_AVERAGE_SEATS;

/** Bovogo's cut. Flat, per booking — not per seat and not per mile. */
export const PLATFORM_FEE_CENTS = 200;

/** Stripe US card pricing, billed on the whole capture. */
export const STRIPE_PERCENT = 0.029;
export const STRIPE_FIXED_CENTS = 30;

/** A pet takes two passenger seats and pays two fares. */
export const FARE_UNITS_PER_PET = 2;

/** Stripe refuses anything under 50¢, so a quote below it cannot be charged. */
export const MIN_CHARGEABLE_CENTS = 50;

export interface QuoteParty {
  humanCount: number;
  petCount: number;
}

export interface BookingQuote {
  quoteVersion: string;

  /** Measured route distance the fare was computed from. */
  miles: number;
  humanCount: number;
  petCount: number;
  /** `humanCount + 2 × petCount` — fares charged and seats consumed. */
  fareUnits: number;
  /** Seats this booking removes from the adventure. Same as `fareUnits`. */
  seats: number;

  /** What one fare unit costs for this distance. */
  perFareUnitCents: number;
  mileageFareCents: number;
  platformFeeCents: number;
  transactionFeeCents: number;
  totalCents: number;

  /** 100% of the mileage fare. The Voyager keeps all of it. */
  driverPayoutCents: number;

  rateCentsPerMile: number;
}

/** Seats consumed / fares charged by a party. One pet counts as two. */
export function fareUnitsFor(party: QuoteParty): number {
  return party.humanCount + FARE_UNITS_PER_PET * party.petCount;
}

/**
 * Stripe's cut of a capture, in cents.
 *
 * Product fee formula: 2.9% of mileage fare plus the $2 platform fee, then 30¢.
 * This is not a guarantee of the processor's actual fee on the final charge.
 */
export function transactionFeeCents(mileageFareCents: number): number {
  const base = Math.max(0, mileageFareCents) + PLATFORM_FEE_CENTS;
  return Math.round(base * STRIPE_PERCENT) + STRIPE_FIXED_CENTS;
}

/** The fare for one unit over a distance. Rounded once, at the unit. */
export function perFareUnitCents(miles: number): number {
  if (!Number.isFinite(miles) || miles <= 0) return 0;
  return Math.round(miles * RIDER_RATE_CENTS_PER_MILE);
}

/**
 * The full quote. Three components and nothing else: the mileage fare, the flat
 * platform fee, and the transaction fee. No insurance, no luggage cover, no
 * surcharge — those were removed from the purchasing path, not hidden inside
 * another line.
 *
 * Throws on a distance that is not a positive finite number rather than
 * returning a zero-dollar quote, because a zero here means the caller skipped
 * the "is this route measurable" check and a free ride is not the failure mode
 * anyone wants.
 */
export function quoteBooking(miles: number, party: QuoteParty): BookingQuote {
  if (!Number.isFinite(miles) || miles <= 0) {
    throw new Error(`quoteBooking needs a measured distance, got ${miles}`);
  }
  const { humanCount, petCount } = party;
  if (!Number.isInteger(humanCount) || humanCount < 1) {
    throw new Error('A booking needs at least one human.');
  }
  if (!Number.isInteger(petCount) || petCount < 0) {
    throw new Error('Pet count must be zero or more.');
  }

  const fareUnits = fareUnitsFor({ humanCount, petCount });
  const perUnit = perFareUnitCents(miles);
  const mileageFareCents = perUnit * fareUnits;
  const txFee = transactionFeeCents(mileageFareCents);

  return {
    quoteVersion: QUOTE_VERSION,
    miles,
    humanCount,
    petCount,
    fareUnits,
    seats: fareUnits,
    perFareUnitCents: perUnit,
    mileageFareCents,
    platformFeeCents: PLATFORM_FEE_CENTS,
    transactionFeeCents: txFee,
    totalCents: mileageFareCents + PLATFORM_FEE_CENTS + txFee,
    driverPayoutCents: mileageFareCents,
    rateCentsPerMile: RIDER_RATE_CENTS_PER_MILE,
  };
}

// ─── The authorized maximum ──────────────────────────────────────────────────
//
// Sushant's decision, 2026-09-14: show an estimate, authorize a higher maximum,
// then settle the verified GPS mileage within it. The gap between the two is a
// disclosed buffer, and nothing above the maximum is ever captured — if a ride
// somehow runs past it, the capture pins at the maximum and the shortfall is
// recorded as uncharged.

/**
 * Default headroom over the measured route, as whole percent.
 *
 * 20% is a proposal, not a user-specified figure. It is enough to absorb the
 * ordinary reasons a real drive is longer than the routed line — a detour for a
 * pickup, a closed road, traffic routing — without holding an alarming multiple
 * of the estimate on someone's card. Override with `MILEAGE_BUFFER_PERCENT`.
 *
 * Whatever it is set to, checkout states it in words and in dollars before the
 * Sailor authorises anything.
 */
export const DEFAULT_BUFFER_PERCENT = 20;

export function configuredBufferPercent(
  raw: string | number | undefined = process.env.MILEAGE_BUFFER_PERCENT,
): number {
  const parsed = typeof raw === 'string' ? Number(raw) : raw;
  if (parsed == null || !Number.isFinite(parsed)) return DEFAULT_BUFFER_PERCENT;
  // A negative buffer would authorize less than the estimate, which is not a
  // buffer. An absurd one would hold a fortune against a short ride.
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export interface CheckoutQuote {
  /** What the Sailor is told to expect. */
  estimate: BookingQuote;
  /** The maximum their card is held for. */
  maximum: BookingQuote;
  bufferPercent: number;
  /** `maximum.totalCents − estimate.totalCents`, for the disclosure copy. */
  bufferCents: number;
}

/**
 * The pair of quotes checkout needs: the estimate and the authorized maximum.
 *
 * The buffer is applied to the *distance*, not to the final total, so the
 * maximum is itself a real quote for a real (longer) journey rather than a
 * marked-up number. That matters when settlement runs: the same arithmetic
 * produced both ends, so a ride that lands anywhere in between prices
 * consistently.
 */
export function quoteCheckout(
  miles: number,
  party: QuoteParty,
  bufferPercent: number = configuredBufferPercent(),
): CheckoutQuote {
  const estimate = quoteBooking(miles, party);
  // Rounded to cents-of-a-mile so the stored `numeric(10,2)` round-trips
  // exactly; settlement compares against this figure.
  const maxMiles = Math.round(miles * (1 + bufferPercent / 100) * 100) / 100;
  const maximum = quoteBooking(Math.max(maxMiles, miles), party);
  return {
    estimate,
    maximum,
    bufferPercent,
    bufferCents: maximum.totalCents - estimate.totalCents,
  };
}

// ─── Authorization lifetime ──────────────────────────────────────────────────

/**
 * How long a card authorization can be relied on, in days.
 *
 * Stripe holds an uncaptured PaymentIntent for a limited window — commonly 7
 * days on cards, but the authoritative value is `capture_before` on the charge,
 * which is read back and stored per booking. This constant is only the *gate*:
 * it decides whether a booking can be taken at all, before any hold exists.
 *
 * Six rather than seven, so a hold placed at the edge of the window still has a
 * day of slack for a delayed departure. See
 * https://docs.stripe.com/payments/place-a-hold-on-a-payment-method
 */
export const AUTHORIZATION_WINDOW_DAYS = 6;

export function authorizationWindowMs(): number {
  return AUTHORIZATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Whether a departure is close enough that a hold taken now will still be
 * capturable when the ride ends.
 *
 * Booking further out is refused rather than quietly accepted — an expired
 * authorization means a Sailor who believes they have a seat, a Voyager who
 * believes they will be paid, and no money behind either. Saying "not yet" is
 * the honest failure.
 */
export function departureWithinAuthorizationWindow(
  departureAt: Date,
  now: Date = new Date(),
): boolean {
  return departureAt.getTime() - now.getTime() <= authorizationWindowMs();
}

/** Cents as the decimal string the `numeric(10,2)` columns expect. */
export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Cents as a plain number of dollars, for a JSON response. */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}
