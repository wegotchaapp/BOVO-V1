import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';

import { NoonlightWebhookController } from './noonlight-webhook.controller';

const SECRET = 'whsec_test_value';

function build(overrides: Record<string, string | undefined> = {}) {
  const handleNoonlightEvent = jest.fn().mockResolvedValue({ applied: true });
  const config = {
    get: (k: string) =>
      ({ NOONLIGHT_WEBHOOK_SECRET: SECRET, NODE_ENV: 'test', ...overrides })[k],
  };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const controller = new NoonlightWebhookController(
    { handleNoonlightEvent } as any,
    config as any,
    logger as any,
  );
  return { controller, handleNoonlightEvent, logger };
}

function req(body: unknown) {
  const raw = Buffer.from(JSON.stringify(body));
  return { rawBody: raw, body: JSON.parse(raw.toString()) };
}

const sign = (r: { rawBody: Buffer }, enc: 'hex' | 'base64') =>
  crypto.createHmac('sha256', SECRET).update(r.rawBody).digest(enc);

describe('NoonlightWebhookController', () => {
  // The shape a real sandbox callback delivers.
  const payload = [
    {
      event_id: 'evt-1',
      event_time: '2026-08-23T09:50:51.440Z',
      event_type: 'alarm.closed',
      meta: { alarm_id: 'alarm-1' },
    },
  ];

  it('accepts a hex signature and forwards the alarm', async () => {
    const { controller, handleNoonlightEvent } = build();
    const r = req(payload);
    const res = await controller.handle(r, {
      'x-noonlight-signature': sign(r, 'hex'),
    });
    expect(res).toEqual({ received: true, events: 1, applied: 1 });
    expect(handleNoonlightEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'alarm.closed',
        meta: { alarm_id: 'alarm-1' },
      }),
    );
  });

  it('accepts a base64 signature', async () => {
    const { controller } = build();
    const r = req(payload);
    await expect(
      controller.handle(r, { 'x-noonlight-signature': sign(r, 'base64') }),
    ).resolves.toMatchObject({ received: true });
  });

  it('rejects a wrong signature without touching the service', async () => {
    const { controller, handleNoonlightEvent } = build();
    await expect(
      controller.handle(req(payload), { 'x-noonlight-signature': 'nope' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(handleNoonlightEvent).not.toHaveBeenCalled();
  });

  it('rejects a missing signature header', async () => {
    const { controller } = build();
    await expect(controller.handle(req(payload), {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a body that was altered after signing', async () => {
    const { controller } = build();
    const original = req(payload);
    const tampered = req([
      { event_type: 'alarm.dispatched', meta: { alarm_id: 'alarm-1' } },
    ]);
    await expect(
      controller.handle(tampered, {
        'x-noonlight-signature': sign(original, 'hex'),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the raw body never reached it', async () => {
    const { controller } = build();
    const r: any = { body: payload };
    await expect(
      controller.handle(r, { 'x-noonlight-signature': 'anything' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // An unverified emergency update must never be processed, and the endpoint
  // must not depend on the runtime supplying any particular environment
  // variable to reach that conclusion. The deploy writes APP_ENV and never
  // writes NODE_ENV, so both spellings of "production" — and the absence of
  // either — are asserted to behave identically.
  describe('fails closed in every environment', () => {
    const environments: Array<[string, Record<string, string | undefined>]> = [
      ['no environment marker at all', { NODE_ENV: undefined }],
      ['NODE_ENV=development', { NODE_ENV: 'development' }],
      ['NODE_ENV=test', { NODE_ENV: 'test' }],
      ['APP_ENV=production', { NODE_ENV: undefined, APP_ENV: 'production' }],
      ['NODE_ENV=production', { NODE_ENV: 'production' }],
    ];

    describe.each(environments)('%s', (_label, env) => {
      it('refuses an unsigned request when no secret is configured, and asks to be retried', async () => {
        const { controller, handleNoonlightEvent } = build({
          ...env,
          NOONLIGHT_WEBHOOK_SECRET: undefined,
        });
        // 503, not 401: the misconfiguration is ours and the alarm update is
        // real, so the provider should retry rather than treat it as handled.
        await expect(
          controller.handle(req(payload), {}),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(handleNoonlightEvent).not.toHaveBeenCalled();
      });

      it('refuses even a correctly-shaped signature when no secret is configured', async () => {
        const { controller, handleNoonlightEvent } = build({
          ...env,
          NOONLIGHT_WEBHOOK_SECRET: undefined,
        });
        const r = req(payload);
        await expect(
          controller.handle(r, { 'x-noonlight-signature': sign(r, 'hex') }),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(handleNoonlightEvent).not.toHaveBeenCalled();
      });

      it('treats a blank secret as no secret', async () => {
        const { controller, handleNoonlightEvent } = build({
          ...env,
          NOONLIGHT_WEBHOOK_SECRET: '',
        });
        await expect(
          controller.handle(req(payload), {}),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(handleNoonlightEvent).not.toHaveBeenCalled();
      });

      it('rejects a missing signature with a secret configured', async () => {
        const { controller, handleNoonlightEvent } = build(env);
        await expect(
          controller.handle(req(payload), {}),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(handleNoonlightEvent).not.toHaveBeenCalled();
      });

      it('rejects an invalid signature with a secret configured', async () => {
        const { controller, handleNoonlightEvent } = build(env);
        const r = req(payload);
        const wrong = crypto
          .createHmac('sha256', 'not-the-secret')
          .update(r.rawBody)
          .digest('hex');
        await expect(
          controller.handle(r, { 'x-noonlight-signature': wrong }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
        expect(handleNoonlightEvent).not.toHaveBeenCalled();
      });

      it('accepts a signature over the exact bytes received', async () => {
        const { controller, handleNoonlightEvent } = build(env);
        const r = req(payload);
        await expect(
          controller.handle(r, { 'x-noonlight-signature': sign(r, 'hex') }),
        ).resolves.toEqual({ received: true, events: 1, applied: 1 });
        expect(handleNoonlightEvent).toHaveBeenCalledTimes(1);
      });
    });

    it('signs the bytes as received, not a re-serialisation of them', async () => {
      // Whitespace a provider chose is part of what they signed. Verifying
      // against `JSON.stringify(req.body)` instead of `req.rawBody` would pass
      // the equivalent-but-different rendering below; this asserts it does not.
      const { controller, handleNoonlightEvent } = build();
      const rawBody = Buffer.from(
        '[ {"event_type" : "alarm.closed" , "meta":{"alarm_id":"alarm-1"}} ]',
      );
      const r = { rawBody, body: JSON.parse(rawBody.toString()) };
      await expect(
        controller.handle(r, { 'x-noonlight-signature': sign(r, 'hex') }),
      ).resolves.toMatchObject({ received: true, applied: 1 });
      expect(handleNoonlightEvent).toHaveBeenCalledTimes(1);

      const reserialised = crypto
        .createHmac('sha256', SECRET)
        .update(JSON.stringify(r.body))
        .digest('hex');
      await expect(
        controller.handle(r, { 'x-noonlight-signature': reserialised }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  it('applies every event in the array', async () => {
    const { controller, handleNoonlightEvent } = build();
    const r = req([
      { event_type: 'alarm.dispatched', meta: { alarm_id: 'a' } },
      { event_type: 'alarm.closed', meta: { alarm_id: 'b' } },
    ]);
    const res = await controller.handle(r, {
      'x-noonlight-signature': sign(r, 'hex'),
    });
    expect(res).toEqual({ received: true, events: 2, applied: 2 });
    expect(handleNoonlightEvent).toHaveBeenCalledTimes(2);
  });

  it('accepts a bare object as a single event', async () => {
    const { controller, handleNoonlightEvent } = build();
    const r = req({ event_type: 'alarm.closed', meta: { alarm_id: 'a' } });
    const res = await controller.handle(r, {
      'x-noonlight-signature': sign(r, 'hex'),
    });
    expect(res).toEqual({ received: true, events: 1, applied: 1 });
    expect(handleNoonlightEvent).toHaveBeenCalledTimes(1);
  });

  it('ignores an empty array', async () => {
    const { controller, handleNoonlightEvent } = build();
    const r = req([]);
    const res = await controller.handle(r, {
      'x-noonlight-signature': sign(r, 'hex'),
    });
    expect(res).toEqual({ received: true, applied: 0, events: 0 });
    expect(handleNoonlightEvent).not.toHaveBeenCalled();
  });

  it('honours a custom signature header name', async () => {
    const { controller } = build({
      NOONLIGHT_WEBHOOK_SIGNATURE_HEADER: 'X-Signature',
    });
    const r = req(payload);
    await expect(
      controller.handle(r, { 'x-signature': sign(r, 'hex') }),
    ).resolves.toMatchObject({ received: true });
  });
});
