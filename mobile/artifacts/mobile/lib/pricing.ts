/**
 * Bovogo pricing — display only. The server is authoritative; these mirror it
 * so the app can show a price before posting or booking.
 *
 * A seat is a cost-share, not a fare. The price is FLAT — $32.40 on every
 * route — derived from the 180-mile reference trip:
 *
 *   180 mi × $0.72 IRS × 75% ÷ 3 seats = $32.40
 *
 * The divisor is fixed at 3 (standard sedan occupancy), NOT the number of seats
 * actually booked, and the price does not move with distance either. A Sailor
 * always knows what a seat costs; a Voyager always knows what they'll recover.
 * If fewer than three seats sell, the Voyager absorbs the difference.
 */

/** IRS standard mileage rate — the ceiling on what may be recovered. */
export const IRS_RATE_PER_MILE = 0.72;

/** Bovogo prices at 75% of that ceiling. */
export const COST_SHARE_FACTOR = 0.75;

/** Standard sedan occupancy the cost-share is divided across. */
export const STANDARD_OCCUPANCY = 3;

/**
 * The per-mile rate the flat price derives from ($0.18). Kept for the
 * "how is this calculated" explainer — it is not what a Sailor is charged.
 */
export const RATE_PER_MILE_PER_SEAT =
  (IRS_RATE_PER_MILE * COST_SHARE_FACTOR) / STANDARD_OCCUPANCY;

/** Reference distance the flat price was derived from. */
export const REFERENCE_TRIP_MILES = 180;

/** Flat cost-share a Sailor pays for one seat, on any route. */
export const SEAT_PRICE = 32.4;

/** Stripe US card pricing — billed on the whole capture, our fee included. */
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED = 0.3;

/** What Bovogo clears per booking after Stripe. Mirrors PLATFORM_TARGET_MARGIN. */
export const PLATFORM_TARGET_MARGIN = 2.0;

/**
 * Platform fee = FIXED + RATE × subtotal, derived so the net margin stays
 * constant at PLATFORM_TARGET_MARGIN for any booking size:
 *
 *   fee = (M + 0.30)/0.971 + (0.029/0.971) × subtotal
 *
 * A purely flat fee would go negative on larger bookings, because Stripe's
 * percentage applies to seats and insurance too.
 */
export const PLATFORM_FEE_RATE = STRIPE_PERCENT / (1 - STRIPE_PERCENT);
export const PLATFORM_FEE_FIXED =
  (STRIPE_FIXED + PLATFORM_TARGET_MARGIN) / (1 - STRIPE_PERCENT);

/** Trip insurance per seat. Provisional pending the MGA terms. */
export const INSURANCE_PREMIUM_PER_SEAT = 15.0;

export type LuggageTier = "carry_on" | "standard" | "large" | "oversized";

/**
 * Luggage surcharge by declared tier. Compensates the Voyager for extra fuel
 * and trunk space, and passes to them in full — Bovogo retains none of it.
 */
export const LUGGAGE_SURCHARGE: Record<LuggageTier, number> = {
  carry_on: 0,
  standard: 3,
  large: 6,
  oversized: 8,
};

/** Optional luggage cover. Bovogo's commission comes from this, not the surcharge. */
export const LUGGAGE_INSURANCE_PREMIUM: Record<LuggageTier, number> = {
  carry_on: 0,
  standard: 3,
  large: 5,
  oversized: 8,
};

export const LUGGAGE_TIER_LABELS: Record<LuggageTier, { title: string; detail: string }> = {
  carry_on: { title: "Carry-on only", detail: "A backpack or small bag" },
  standard: { title: "1–2 large suitcases", detail: "Standard checked luggage" },
  large: { title: "3–4 large suitcases", detail: "A lot of trunk space" },
  oversized: { title: "Oversized or instruments", detail: "Skis, bikes, cellos" },
};

/** Bovogo Premium (Travel+) subscription, in USD per month. */
export const PREMIUM_PRICE_PER_MONTH = 15;

/** Flat cost-share for one seat. Distance arguments are ignored by design. */
export function seatPriceForMiles(_miles?: number): number {
  return SEAT_PRICE;
}

/** Flat cost-share for one seat between two cities. */
export function seatPrice(_from?: string, _to?: string): number {
  return SEAT_PRICE;
}

/** What the Voyager collects if every offered seat sells. */
export function adventureTotal(_from: string, _to: string, seats: number): number {
  if (!Number.isFinite(seats) || seats <= 0) return 0;
  return Math.round(SEAT_PRICE * seats * 100) / 100;
}

/** Bovogo's fee for a booking subtotal (seats + insurance + surcharges). */
export function platformFee(subtotal: number): number {
  const raw = PLATFORM_FEE_FIXED + PLATFORM_FEE_RATE * Math.max(0, subtotal);
  return Math.round(raw * 100) / 100;
}

/** The IRS ceiling for a route — what the Voyager must stay under. */
export function irsCeilingForRoute(from: string, to: string): number {
  return Math.round(getDistanceMiles(from, to) * IRS_RATE_PER_MILE * 100) / 100;
}

/**
 * Format a USD amount for display — whole dollars stay clean ("$15"), cents
 * are shown when they exist ("$32.50").
 */
export function formatUsd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/**
 * Hard-coded driving distances between major Texas cities (miles).
 * Used for route display and as a fallback when no odometer reading exists.
 */
const DISTANCE_TABLE: Record<string, Record<string, number>> = {
  "Dallas, TX":      { "Austin, TX": 195, "Houston, TX": 239, "San Antonio, TX": 272, "Fort Worth, TX": 35,  "El Paso, TX": 635, "Waco, TX": 99,  "Plano, TX": 20,  "Lubbock, TX": 318, "Corpus Christi, TX": 388, "Arlington, TX": 21, "Amarillo, TX": 362 },
  "Austin, TX":      { "Dallas, TX": 195, "Houston, TX": 162, "San Antonio, TX": 79,  "Fort Worth, TX": 190, "El Paso, TX": 575, "Waco, TX": 102, "Plano, TX": 215, "Lubbock, TX": 380, "Corpus Christi, TX": 217, "Arlington, TX": 195, "Amarillo, TX": 487 },
  "Houston, TX":     { "Dallas, TX": 239, "Austin, TX": 162,  "San Antonio, TX": 197, "Fort Worth, TX": 263, "El Paso, TX": 745, "Waco, TX": 184, "Plano, TX": 261, "Lubbock, TX": 506, "Corpus Christi, TX": 211, "Arlington, TX": 257, "Amarillo, TX": 596 },
  "San Antonio, TX": { "Dallas, TX": 272, "Austin, TX": 79,   "Houston, TX": 197,     "Fort Worth, TX": 264, "El Paso, TX": 553, "Waco, TX": 178, "Plano, TX": 287, "Lubbock, TX": 410, "Corpus Christi, TX": 145, "Arlington, TX": 263, "Amarillo, TX": 510 },
  "Fort Worth, TX":  { "Dallas, TX": 35,  "Austin, TX": 190,  "Houston, TX": 263,     "San Antonio, TX": 264, "El Paso, TX": 600, "Waco, TX": 90,  "Plano, TX": 41,  "Lubbock, TX": 320, "Corpus Christi, TX": 410, "Arlington, TX": 12, "Amarillo, TX": 345 },
};

const DEFAULT_DISTANCE_MILES = 150;

/**
 * Look up driving distance (miles) between two Texas cities.
 * Falls back to a default when the route isn't tabulated.
 */
export function getDistanceMiles(from: string, to: string): number {
  if (!from || !to || from === to) return 0;
  return DISTANCE_TABLE[from]?.[to] ?? DISTANCE_TABLE[to]?.[from] ?? DEFAULT_DISTANCE_MILES;
}
