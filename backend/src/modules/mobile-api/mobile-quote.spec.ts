import {
  AUTHORIZATION_WINDOW_DAYS,
  PLATFORM_FEE_CENTS,
  RIDER_RATE_CENTS_PER_MILE,
  configuredBufferPercent,
  departureWithinAuthorizationWindow,
  fareUnitsFor,
  perFareUnitCents,
  quoteBooking,
  quoteCheckout,
  transactionFeeCents,
} from './mobile-quote';

/**
 * The arithmetic the whole product charges on.
 *
 * The acceptance figures here are Sushant's own, from
 * `workflow/PRICING_USER_DECISIONS.md` as corrected on 2026-09-20. They are
 * written as literal expected cents rather than recomputed from the constants,
 * deliberately: a test that derives its expectation the same way the code does
 * would agree with the code even when both are wrong.
 */
describe('the rate', () => {
  it('divides the 54-cent base rate by a fixed three seats', () => {
    expect(RIDER_RATE_CENTS_PER_MILE).toBe(18);
    expect(perFareUnitCents(180)).toBe(3240);
    expect(perFareUnitCents(200)).toBe(3600);
  });
  it('keeps the divisor fixed when the booking party changes', () => {
    expect(quoteBooking(200, { humanCount: 2, petCount: 0 }).mileageFareCents).toBe(7200);
  });
});

describe('quoteBooking — Sushant’s acceptance examples', () => {
  it('180 mi, 1 person: 32.40 fare + 2.00 platform + 1.30 processing = 35.70', () => {
    const q = quoteBooking(180, { humanCount: 1, petCount: 0 });
    expect(q.mileageFareCents).toBe(3240);
    expect(q.platformFeeCents).toBe(200);
    expect(q.transactionFeeCents).toBe(130);
    expect(q.totalCents).toBe(3570);
  });

  it('a pet on that route is charged 64.80 — two human fares', () => {
    const solo = quoteBooking(180, { humanCount: 1, petCount: 0 });
    const withPet = quoteBooking(180, { humanCount: 1, petCount: 1 });
    expect(withPet.mileageFareCents - solo.mileageFareCents).toBe(6480);
  });

  it('gives the Voyager 100% of the mileage fare and nothing else', () => {
    const q = quoteBooking(180, { humanCount: 2, petCount: 1 });
    expect(q.driverPayoutCents).toBe(q.mileageFareCents);
    // The platform fee and the processing fee are charged on top and are not
    // the Voyager's. If this ever equals the total, the driver is being paid
    // Bovogo's cut and Stripe's.
    expect(q.driverPayoutCents).toBeLessThan(q.totalCents);
  });
});

describe('pets consume two seats and two fares', () => {
  it('counts one pet as two fare units', () => {
    expect(fareUnitsFor({ humanCount: 1, petCount: 0 })).toBe(1);
    expect(fareUnitsFor({ humanCount: 1, petCount: 1 })).toBe(3);
    expect(fareUnitsFor({ humanCount: 2, petCount: 2 })).toBe(6);
  });

  it('reports seats equal to fare units, so capacity math is unchanged', () => {
    const q = quoteBooking(100, { humanCount: 2, petCount: 1 });
    expect(q.fareUnits).toBe(4);
    expect(q.seats).toBe(4);
  });

  it('prices a pet exactly as two extra people would be priced', () => {
    const pet = quoteBooking(120, { humanCount: 1, petCount: 1 });
    const threePeople = quoteBooking(120, { humanCount: 3, petCount: 0 });
    expect(pet.mileageFareCents).toBe(threePeople.mileageFareCents);
    expect(pet.totalCents).toBe(threePeople.totalCents);
  });
});

describe('the processing fee', () => {
  it('is 2.9% of fare + platform, plus 30 cents', () => {
    // round((9720 + 200) × 0.029) + 30 = 288 + 30
    expect(transactionFeeCents(9720)).toBe(318);
  });

  it('still charges the fixed part on a zero fare', () => {
    expect(transactionFeeCents(0)).toBe(Math.round(200 * 0.029) + 30);
  });

  it('is computed on the platform fee too, not the fare alone', () => {
    // If the $2 were left out, this would be round(9720 × 0.029) + 30 = 312.
    expect(transactionFeeCents(9720)).not.toBe(312);
  });
});

describe('the three components are the whole price', () => {
  it('totals to fare + platform + processing and nothing else', () => {
    for (const miles of [1, 37.5, 100, 180, 642.25]) {
      for (const party of [
        { humanCount: 1, petCount: 0 },
        { humanCount: 3, petCount: 0 },
        { humanCount: 1, petCount: 2 },
      ]) {
        const q = quoteBooking(miles, party);
        expect(q.totalCents).toBe(
          q.mileageFareCents + q.platformFeeCents + q.transactionFeeCents,
        );
        // No insurance, no luggage surcharge, no fourth line hiding anywhere.
        expect(q.platformFeeCents).toBe(PLATFORM_FEE_CENTS);
      }
    }
  });

  it('is always a whole number of cents', () => {
    for (const miles of [0.01, 3.33, 87.77, 181.19]) {
      const q = quoteBooking(miles, { humanCount: 1, petCount: 1 });
      for (const v of [
        q.mileageFareCents,
        q.platformFeeCents,
        q.transactionFeeCents,
        q.totalCents,
        q.driverPayoutCents,
      ]) {
        expect(Number.isInteger(v)).toBe(true);
      }
    }
  });
});

describe('quoteBooking refuses nonsense rather than pricing it', () => {
  it.each([
    { humanCount: 1.5, petCount: 0 },
    { humanCount: 1, petCount: 0.5 },
  ])('rejects fractional party counts: %p', (party) => {
    expect(() => quoteBooking(200, party)).toThrow();
  });

  it.each([0, -1, NaN, Infinity])('rejects %p miles', (miles) => {
    // A zero-distance quote would be a free ride, which is not the failure mode
    // anyone wants from a missing measurement.
    expect(() => quoteBooking(miles, { humanCount: 1, petCount: 0 })).toThrow();
  });

  it('rejects a party with no humans — a pet cannot ride alone', () => {
    expect(() => quoteBooking(100, { humanCount: 0, petCount: 1 })).toThrow();
  });

  it('rejects a negative pet count', () => {
    expect(() => quoteBooking(100, { humanCount: 1, petCount: -1 })).toThrow();
  });
});

describe('the authorized maximum', () => {
  it('holds more than the estimate, by the buffer, on distance', () => {
    const c = quoteCheckout(180, { humanCount: 1, petCount: 0 }, 20);
    expect(c.estimate.totalCents).toBe(3570);
    expect(c.maximum.miles).toBe(216);
    expect(c.maximum.totalCents).toBeGreaterThan(c.estimate.totalCents);
    expect(c.bufferCents).toBe(c.maximum.totalCents - c.estimate.totalCents);
  });

  it('prices the maximum as a real quote for the longer journey', () => {
    // Not a percentage slapped on the total: the same arithmetic produced both
    // ends, so a ride landing in between settles consistently.
    const c = quoteCheckout(100, { humanCount: 2, petCount: 0 }, 20);
    const direct = quoteBooking(120, { humanCount: 2, petCount: 0 });
    expect(c.maximum.totalCents).toBe(direct.totalCents);
  });

  it('never authorizes less than the estimate, whatever the buffer', () => {
    for (const buffer of [0, 5, 20, 100]) {
      const c = quoteCheckout(150, { humanCount: 1, petCount: 1 }, buffer);
      expect(c.maximum.totalCents).toBeGreaterThanOrEqual(
        c.estimate.totalCents,
      );
      expect(c.bufferCents).toBeGreaterThanOrEqual(0);
    }
  });

  it('clamps an absurd or malformed configured buffer', () => {
    expect(configuredBufferPercent('20')).toBe(20);
    expect(configuredBufferPercent('-5')).toBe(0);
    expect(configuredBufferPercent('9000')).toBe(100);
    expect(configuredBufferPercent('nonsense')).toBe(20);
    expect(configuredBufferPercent(undefined)).toBe(20);
  });
});

describe('the authorization window gate', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = new Date('2026-09-20T12:00:00Z');

  it('accepts a departure inside the window', () => {
    const soon = new Date(now.getTime() + 2 * day);
    expect(departureWithinAuthorizationWindow(soon, now)).toBe(true);
  });

  it('refuses one beyond it, because the hold would lapse first', () => {
    const far = new Date(now.getTime() + (AUTHORIZATION_WINDOW_DAYS + 1) * day);
    expect(departureWithinAuthorizationWindow(far, now)).toBe(false);
  });

  it('accepts a departure exactly at the boundary', () => {
    const edge = new Date(now.getTime() + AUTHORIZATION_WINDOW_DAYS * day);
    expect(departureWithinAuthorizationWindow(edge, now)).toBe(true);
  });
});
