import { calculateRefund, RefundCalculationInput } from './refund-calculator';

const PLATFORM_FEE_CENTS = 250;
const INSURANCE_CENTS = 900;

describe('calculateRefund', () => {
  const baseInput: RefundCalculationInput = {
    totalPaidCents: 5500,
    hoursUntilDeparture: 48,
    isDriverCancelling: false,
    isSafetyReason: false,
    isCaptured: false,
    driverCancellationCount: 0,
    insuranceOptedIn: true,
  };

  describe('driver cancellation', () => {
    it('gives full refund and flags after 3 cancellations', () => {
      const result = calculateRefund({
        ...baseInput,
        isDriverCancelling: true,
        driverCancellationCount: 3,
      });
      expect(result.refundAmountCents).toBe(5500);
      expect(result.refundPercentage).toBe(100);
      expect(result.requiresRefund).toBe(true);
      expect(result.requiresFlag).toBe(true);
      expect(result.reason).toContain('Driver cancellation');
    });

    it('gives full refund without flag for first cancellation', () => {
      const result = calculateRefund({
        ...baseInput,
        isDriverCancelling: true,
        driverCancellationCount: 0,
      });
      expect(result.refundAmountCents).toBe(5500);
      expect(result.requiresFlag).toBe(false);
    });

    it('flags driver at exactly 3 cancellations', () => {
      const result = calculateRefund({
        ...baseInput,
        isDriverCancelling: true,
        driverCancellationCount: 3,
      });
      expect(result.requiresFlag).toBe(true);
    });
  });

  describe('safety reason cancellation', () => {
    it('gives full refund regardless of timing', () => {
      const result = calculateRefund({
        ...baseInput,
        hoursUntilDeparture: 2,
        isSafetyReason: true,
      });
      expect(result.refundAmountCents).toBe(5500);
      expect(result.refundPercentage).toBe(100);
      expect(result.requiresFlag).toBe(false);
    });

    it('gives full refund even after payment captured', () => {
      const result = calculateRefund({
        ...baseInput,
        hoursUntilDeparture: 1,
        isSafetyReason: true,
        isCaptured: true,
      });
      expect(result.refundAmountCents).toBe(5500);
      expect(result.refundPercentage).toBe(100);
    });
  });

  describe('rider cancellation >24h before departure', () => {
    it('gives full refund at 25h when not captured', () => {
      const result = calculateRefund({
        ...baseInput,
        hoursUntilDeparture: 25,
        isCaptured: false,
      });
      expect(result.refundAmountCents).toBe(5500);
      expect(result.refundPercentage).toBe(100);
    });

    it('deducts Stripe fee at 48h when captured', () => {
      const result = calculateRefund({
        ...baseInput,
        hoursUntilDeparture: 48,
        isCaptured: true,
      });
      const stripeCost = Math.round(5500 * 0.029) + 30;
      expect(result.refundAmountCents).toBe(5500 - stripeCost);
    });
  });

  describe('rider cancellation 6-24h before departure', () => {
    it('refunds 50% of ride + full insurance at 20h', () => {
      const result = calculateRefund({
        ...baseInput,
        hoursUntilDeparture: 20,
      });
      const rideCost = 5500 - PLATFORM_FEE_CENTS - INSURANCE_CENTS;
      const expectedRefund = Math.floor(rideCost * 0.5) + INSURANCE_CENTS;
      expect(result.refundAmountCents).toBe(expectedRefund);
      expect(result.refundPercentage).toBe(Math.round((expectedRefund / 5500) * 100));
      expect(result.requiresRefund).toBe(true);
    });

    it('handles case with no insurance opted in', () => {
      const result = calculateRefund({
        totalPaidCents: 5000,
        hoursUntilDeparture: 18,
        isDriverCancelling: false,
        isSafetyReason: false,
        isCaptured: false,
        driverCancellationCount: 0,
        insuranceOptedIn: false,
      });
      const rideAndInsurance = 5000 - PLATFORM_FEE_CENTS;
      const expectedRefund = Math.floor(rideAndInsurance * 0.5);
      expect(result.refundAmountCents).toBe(expectedRefund);
    });
  });

  describe('rider cancellation <6h before departure', () => {
    it('gives no refund when payment already captured', () => {
      const result = calculateRefund({
        ...baseInput,
        hoursUntilDeparture: 6,
        isCaptured: true,
      });
      expect(result.refundAmountCents).toBe(0);
      expect(result.refundPercentage).toBe(0);
      expect(result.requiresRefund).toBe(false);
    });

    it('gives 50% of (total - platform fee) when not captured', () => {
      const result = calculateRefund({
        ...baseInput,
        hoursUntilDeparture: 6,
        isCaptured: false,
      });
      const expectedRefund = Math.floor((5500 - PLATFORM_FEE_CENTS) * 0.5);
      expect(result.refundAmountCents).toBe(expectedRefund);
      expect(result.requiresRefund).toBe(true);
    });

    it('gives insurance premium refund at 1h not captured', () => {
      const result = calculateRefund({
        ...baseInput,
        hoursUntilDeparture: 1,
        isCaptured: false,
      });
      const expectedRefund = Math.floor((5500 - PLATFORM_FEE_CENTS) * 0.5);
      expect(result.refundAmountCents).toBe(expectedRefund);
    });
  });

  describe('boundary conditions', () => {
    it('exactly 24h falls into 6-24h bracket (50% refund)', () => {
      const result = calculateRefund({
        ...baseInput,
        hoursUntilDeparture: 24,
      });
      const rideCost = 5500 - PLATFORM_FEE_CENTS - INSURANCE_CENTS;
      const expectedRefund = Math.floor(rideCost * 0.5) + INSURANCE_CENTS;
      expect(result.refundAmountCents).toBe(expectedRefund);
    });

    it('exactly 6h falls into <6h bracket', () => {
      const result = calculateRefund({
        ...baseInput,
        hoursUntilDeparture: 6,
        isCaptured: false,
      });
      const expectedRefund = Math.floor((5500 - PLATFORM_FEE_CENTS) * 0.5);
      expect(result.refundAmountCents).toBe(expectedRefund);
    });
  });

  describe('refund percentage calculation', () => {
    it('calculates correct percentage for 6-24h partial refund', () => {
      const result = calculateRefund({
        ...baseInput,
        hoursUntilDeparture: 18,
      });
      const rideCost = 5500 - PLATFORM_FEE_CENTS - INSURANCE_CENTS;
      const expectedRefund = Math.floor(rideCost * 0.5) + INSURANCE_CENTS;
      expect(result.refundPercentage).toBe(Math.round((expectedRefund / 5500) * 100));
    });

    it('percentage is 100 for full refund', () => {
      const result = calculateRefund({
        ...baseInput,
        hoursUntilDeparture: 48,
      });
      expect(result.refundPercentage).toBe(100);
    });

    it('percentage is 0 for no refund', () => {
      const result = calculateRefund({
        ...baseInput,
        hoursUntilDeparture: 6,
        isCaptured: true,
      });
      expect(result.refundPercentage).toBe(0);
    });
  });
});
