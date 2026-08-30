import { UnauthorizedException } from '@nestjs/common';
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

  it('fails closed in production when no secret is configured', async () => {
    const { controller, handleNoonlightEvent } = build({
      NOONLIGHT_WEBHOOK_SECRET: undefined,
      NODE_ENV: 'production',
    });
    await expect(controller.handle(req(payload), {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(handleNoonlightEvent).not.toHaveBeenCalled();
  });

  it('allows unsigned traffic outside production so sandbox bring-up can start', async () => {
    const { controller, handleNoonlightEvent, logger } = build({
      NOONLIGHT_WEBHOOK_SECRET: undefined,
    });
    await expect(controller.handle(req(payload), {})).resolves.toMatchObject({
      received: true,
    });
    expect(handleNoonlightEvent).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
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
