import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

/**
 * `/payments/subscription/confirm` is the only thing standing between an
 * authenticated caller and 30 days of premium. The caller picks the
 * PaymentIntent id, so each of these cases is an intent that really exists and
 * really succeeded — just not one that entitles *this* user to Travel+.
 */
const USER_ID = 'user-under-test';
const OTHER_USER_ID = 'user-who-actually-paid';

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function intent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pi_synthetic',
    status: 'succeeded',
    currency: 'usd',
    amount: 1500,
    amount_received: 1500,
    created: nowSeconds() - 30,
    metadata: { type: 'guild_subscription', user_id: USER_ID },
    ...overrides,
  };
}

describe('Travel+ subscription confirmation', () => {
  let controller: PaymentsController;
  let retrieve: jest.Mock;
  let update: jest.Mock;
  let findOne: jest.Mock;

  const request = { user: { id: USER_ID } };

  function build(secretKey = 'sk_test_synthetic_only'): void {
    retrieve = jest.fn().mockResolvedValue(intent());
    update = jest.fn().mockResolvedValue({ affected: 1 });
    findOne = jest.fn().mockResolvedValue({
      id: USER_ID,
      subscription_tier: 'free',
    });

    const config = {
      get: (key: string) =>
        ({
          STRIPE_SECRET_KEY: secretKey,
          STRIPE_WEBHOOK_SECRET: 'whsec_synthetic',
        })[key],
    } as unknown as ConfigService;

    controller = new PaymentsController(
      {} as PaymentsService,
      { findOne, update } as any,
      config,
    );
    (controller as any).stripe = { paymentIntents: { retrieve } };
  }

  beforeEach(() => build());

  it('activates premium for an intent that matches on every property', async () => {
    await expect(
      controller.confirmSubscription(request, {
        payment_intent_id: 'pi_synthetic',
      }),
    ).resolves.toEqual({ activated: true });

    expect(update).toHaveBeenCalledTimes(1);
    const [id, patch] = update.mock.calls[0];
    expect(id).toBe(USER_ID);
    expect(patch.subscription_tier).toBe('premium');
    const expiresIn =
      Date.parse(patch.subscription_expires_at) - Date.now();
    // 30 days, allowing for the milliseconds this test takes to run.
    expect(expiresIn).toBeGreaterThan(29.9 * 86400000);
    expect(expiresIn).toBeLessThanOrEqual(30 * 86400000);
  });

  it('refuses an intent belonging to another account', async () => {
    retrieve.mockResolvedValue(
      intent({
        metadata: { type: 'guild_subscription', user_id: OTHER_USER_ID },
      }),
    );

    await expect(
      controller.confirmSubscription(request, {
        payment_intent_id: 'pi_someone_elses',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses an intent with no owner recorded at all', async () => {
    retrieve.mockResolvedValue(
      intent({ metadata: { type: 'guild_subscription' } }),
    );

    await expect(
      controller.confirmSubscription(request, {
        payment_intent_id: 'pi_unowned',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a booking charge rather than a subscription',
      intent({ metadata: { type: 'booking', user_id: USER_ID } }),
    ],
    [
      'an intent carrying no metadata',
      intent({ metadata: undefined }),
    ],
    [
      'a payment still awaiting confirmation',
      intent({ status: 'requires_payment_method' }),
    ],
    [
      'a payment that was only authorized',
      intent({ status: 'requires_capture', amount_received: 0 }),
    ],
    [
      'a cheaper currency with the same numeric amount',
      intent({ currency: 'mxn' }),
    ],
    ['an underpayment', intent({ amount: 100, amount_received: 100 })],
    [
      'a full-price intent that only partially captured',
      intent({ amount: 1500, amount_received: 1 }),
    ],
    [
      'an intent from last week',
      intent({ created: nowSeconds() - 7 * 86400 }),
    ],
    [
      'an intent with no creation timestamp',
      intent({ created: undefined }),
    ],
  ])('refuses %s', async (_label, retrieved) => {
    retrieve.mockResolvedValue(retrieved);

    await expect(
      controller.confirmSubscription(request, {
        payment_intent_id: 'pi_synthetic',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('requires a payment intent id instead of trusting an empty body', async () => {
    await expect(
      controller.confirmSubscription(request, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(retrieve).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  // The removed shortcut keyed off the *name* of the configured Stripe key, so
  // these are the exact key shapes that used to hand out premium for free.
  it.each(['sk_test_local_mock', 'sk_test_mock', 'sk_live_mock_placeholder'])(
    'grants nothing on a %s key with an empty body',
    async (secretKey) => {
      build(secretKey);

      await expect(
        controller.confirmSubscription(request, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('still verifies the intent when the key looks like a mock', async () => {
    build('sk_test_local_mock');
    retrieve.mockResolvedValue(
      intent({
        metadata: { type: 'guild_subscription', user_id: OTHER_USER_ID },
      }),
    );

    await expect(
      controller.confirmSubscription(request, {
        payment_intent_id: 'pi_someone_elses',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('short-circuits an existing subscriber without touching Stripe', async () => {
    findOne.mockResolvedValue({
      id: USER_ID,
      subscription_tier: 'premium',
    });

    await expect(
      controller.confirmSubscription(request, {
        payment_intent_id: 'pi_synthetic',
      }),
    ).resolves.toEqual({ activated: true });
    expect(retrieve).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('Travel+ subscription intent creation', () => {
  it('stamps the buyer and product onto the intent confirm later checks', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'pi_synthetic',
      client_secret: 'pi_synthetic_secret',
    });
    const controller = new PaymentsController(
      {} as PaymentsService,
      {
        findOne: jest.fn().mockResolvedValue({ subscription_tier: 'free' }),
        update: jest.fn(),
      } as any,
      {
        get: () => 'sk_test_synthetic_only',
      } as unknown as ConfigService,
    );
    (controller as any).stripe = { paymentIntents: { create } };

    await controller.createSubscriptionPaymentIntent({ user: { id: USER_ID } });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1500,
        currency: 'usd',
        metadata: { type: 'guild_subscription', user_id: USER_ID },
      }),
    );
  });

  it('surfaces a Stripe failure rather than returning a pretend intent', async () => {
    const controller = new PaymentsController(
      {} as PaymentsService,
      {
        findOne: jest.fn().mockResolvedValue({ subscription_tier: 'free' }),
        update: jest.fn(),
      } as any,
      { get: () => 'sk_test_synthetic_only' } as unknown as ConfigService,
    );
    (controller as any).stripe = {
      paymentIntents: {
        create: jest.fn().mockRejectedValue(new Error('card_declined')),
      },
    };

    await expect(
      controller.createSubscriptionPaymentIntent({ user: { id: USER_ID } }),
    ).rejects.toThrow('card_declined');
  });
});
