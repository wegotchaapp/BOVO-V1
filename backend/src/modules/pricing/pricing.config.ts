function env(key: string, fallback: number): number {
  const val = process.env[key];
  return val !== undefined ? parseFloat(val) : fallback;
}

export const PRICING = {
  BASE_SEAT_PRICE: 31.50,
  get IRS_RATE() { return env('IRS_MILEAGE_RATE', 0.70); },
  get SAFETY_FACTOR() { return 0.75; },
  MIN_DISTANCE_MILES: 60,
  MAX_DISTANCE_MILES: 400,
  get PLATFORM_FEE() { return env('PLATFORM_FEE', 2.50); },
  get INSURANCE_PREMIUM() { return env('INSURANCE_PREMIUM', 9.00); },
  get INSURANCE_COMMISSION() { return 0.25; },
  STANDARD_OCCUPANCY_SEDAN: 3,
  LUGGAGE_SURCHARGE: {
    carry_on: 0,
    standard: 3,
    large: 6,
    oversized: 8,
  } as Record<string, number>,
  LUGGAGE_INSURANCE_COMMISSION: 0.20,
  LUGGAGE_INSURANCE_PREMIUMS: {
    carry_on: 0,
    standard: 3,
    large: 5,
    oversized: 8,
  } as Record<string, number>,
};
