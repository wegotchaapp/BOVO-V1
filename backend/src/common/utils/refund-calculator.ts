import { PRICING } from '../../modules/pricing/pricing.config';

export interface RefundCalculationInput {
  totalPaidCents: number;
  hoursUntilDeparture: number;
  isDriverCancelling: boolean;
  isSafetyReason: boolean;
  isCaptured: boolean;
  driverCancellationCount: number;
  insuranceOptedIn?: boolean;
}

export interface RefundCalculationResult {
  refundAmountCents: number;
  refundPercentage: number;
  reason: string;
  requiresRefund: boolean;
  requiresFlag: boolean;
}

const PLATFORM_FEE_CENTS = Math.round(PRICING.PLATFORM_FEE * 100);

export function calculateRefund(input: RefundCalculationInput): RefundCalculationResult {
  const { totalPaidCents, hoursUntilDeparture, isDriverCancelling, isSafetyReason, driverCancellationCount } = input;

  if (isDriverCancelling) {
    const needsFlag = driverCancellationCount >= 3;
    return {
      refundAmountCents: totalPaidCents,
      refundPercentage: 100,
      reason: 'Driver cancellation — full refund',
      requiresRefund: true,
      requiresFlag: needsFlag,
    };
  }

  if (isSafetyReason) {
    return {
      refundAmountCents: totalPaidCents,
      refundPercentage: 100,
      reason: 'Safety reason — full refund',
      requiresRefund: true,
      requiresFlag: false,
    };
  }

  if (hoursUntilDeparture > 24) {
    const stripeCost = input.isCaptured ? Math.round(totalPaidCents * 0.029) + 30 : 0;
    const refundAmount = totalPaidCents - stripeCost;
    return {
      refundAmountCents: refundAmount,
      refundPercentage: Math.round((refundAmount / totalPaidCents) * 100),
      reason: 'Cancellation >24h before departure — full refund minus Stripe processing',
      requiresRefund: true,
      requiresFlag: false,
    };
  }

  if (hoursUntilDeparture > 6) {
    const rideAndInsurance = totalPaidCents - PLATFORM_FEE_CENTS;
    let totalRefund: number;
    if (input.insuranceOptedIn) {
      const insuranceCents = Math.round(PRICING.INSURANCE_PREMIUM * 100);
      const rideCost = rideAndInsurance - insuranceCents;
      const rideRefund = Math.floor(rideCost * 0.5);
      totalRefund = rideRefund + insuranceCents;
    } else {
      totalRefund = Math.floor(rideAndInsurance * 0.5);
    }
    const percentage = Math.round((totalRefund / totalPaidCents) * 100);

    return {
      refundAmountCents: totalRefund,
      refundPercentage: percentage,
      reason: 'Cancellation 6-24h before departure — 50% ride refund, full insurance refund (platform fee retained)',
      requiresRefund: true,
      requiresFlag: false,
    };
  }

  if (input.isCaptured) {
    return {
      refundAmountCents: 0,
      refundPercentage: 0,
      reason: 'Cancellation <6h before departure — payment already captured, no refund',
      requiresRefund: false,
      requiresFlag: false,
    };
  }

  const refundAmountCents = Math.floor((totalPaidCents - PLATFORM_FEE_CENTS) * 0.5);
  return {
    refundAmountCents,
    refundPercentage: Math.round((refundAmountCents / totalPaidCents) * 100),
    reason: 'Cancellation <6h before departure — 50% refund of ride & insurance (platform fee retained)',
    requiresRefund: true,
    requiresFlag: false,
  };
}
