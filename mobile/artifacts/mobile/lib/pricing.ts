/**
 * IRS cost-sharing pricing utilities.
 *
 * Bovogo is a cost-sharing platform (not a TNC). Drivers may only recover
 * actual travel costs at the IRS standard mileage rate, divided by the
 * number of seats. They may not charge above this amount.
 *
 * 2026 IRS standard business mileage rate: $0.67 / mile.
 * Bovogo applies a 0.75 discount factor so riders pay 75% of the IRS ceiling.
 *
 * Formula: (miles × $0.67 × 0.75) ÷ seats
 */

export const IRS_RATE_PER_MILE = 0.67;

/** Bovogo discount factor — riders pay 75% of the IRS mileage ceiling. */
export const BOVOGO_RATE_FACTOR = 0.75;

/** Effective per-mile rate charged to riders. */
export const EFFECTIVE_RATE_PER_MILE = IRS_RATE_PER_MILE * BOVOGO_RATE_FACTOR; // $0.5025/mile

/**
 * Hard-coded driving distances between major Texas cities (miles).
 * Used as a stand-in for a real distance API.
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

/**
 * Compute the Bovogo cost-recovery price per seat using the updated formula:
 *   (miles × $0.67 × 0.75) ÷ seats
 * Rounded up to the nearest dollar so drivers never accidentally charge below cost.
 */
export function calculateSuggestedPrice(from: string, to: string, seats: number): number {
  const miles = getDistanceMiles(from, to);
  if (seats <= 0 || miles <= 0) return 0;
  return Math.ceil((miles * IRS_RATE_PER_MILE * BOVOGO_RATE_FACTOR) / seats);
}
