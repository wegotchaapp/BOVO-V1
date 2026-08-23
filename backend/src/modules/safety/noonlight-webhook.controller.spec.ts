import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

import { NoonlightWebhookController } from './noonlight-webhook.controller';

const SECRET = 'whsec_test_value';

function build(overrides: Record<string, string | undefined> = {}) {
  const handleNoonlightWebhook = jest.fn().mockResolvedValue({ applied: true });
  const config = {
    get: (k: string) =>
      ({ NOONLIGHT_WEBHOOK_SECRET: SECRET, NODE_ENV: 'test', ...overrides })[k],
  };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const controller = new NoonlightWebhookController(
    { handleNoonlightWebhook } as any,
    config as any,
    logger as any,
  );
  return { controller, handleNoonlightWebhook, logger };
}

function req(body: unknown) {
  const raw = Buffer.from(JSON.stringify(body));
  return { rawBody: raw, body: JSON.parse(raw.toString()) };
}

const sign = (r: { rawBody: Buffer }, enc: 'hex' | 'base64') =>
  crypto.createHmac('sha256', SECRET).update(r.rawBody).digest(enc);

describe('NoonlightWebhookController', () => {
  const payload = { alarm_id: 'alarm-1', status: 'dispatched' };

  it('accepts a hex signature and forwards the alarm', async () => {
    const { controller, handleNoonlightWebhook } = build();
    const r = req(payload);
    const res = await controller.handle(r, { 'x-noonlight-signature': sign(r, 'hex') });
    expect(res).toEqual({ received: true, applied: true });
    expect(handleNoonlightWebhook).toHaveBeenCalledWith({
      alarm_id: 'alarm-1',
      status: 'dispatched',
      dispatch_status: undefined,
    });
  });

  it('accepts a base64 signature', async () => {
    const { controller } = build();
    const r = req(payload);
    await expect(
      controller.handle(r, { 'x-noonlight-signature': sign(r, 'base64') }),
    ).resolves.toMatchObject({ received: true });
  });

  it('rejects a wrong signature without touching the service', async () => {
    const { controller, handleNoonlightWebhook } = build();
    await expect(
      controller.handle(req(payload), { 'x-noonlight-signature': 'nope' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(handleNoonlightWebhook).not.toHaveBeenCalled();
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
    const tampered = req({ alarm_id: 'alarm-1', status: 'cancelled' });
    await expect(
      controller.handle(tampered, { 'x-noonlight-signature': sign(original, 'hex') }),
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
    const { controller, handleNoonlightWebhook } = build({
      NOONLIGHT_WEBHOOK_SECRET: undefined,
      NODE_ENV: 'production',
    });
    await expect(controller.handle(req(payload), {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(handleNoonlightWebhook).not.toHaveBeenCalled();
  });

  it('allows unsigned traffic outside production so sandbox bring-up can start', async () => {
    const { controller, handleNoonlightWebhook, logger } = build({
      NOONLIGHT_WEBHOOK_SECRET: undefined,
    });
    await expect(controller.handle(req(payload), {})).resolves.toMatchObject({
      received: true,
    });
    expect(handleNoonlightWebhook).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('ignores a payload with no alarm_id', async () => {
    const { controller, handleNoonlightWebhook } = build();
    const r = req({ id: 'alarm-1' });
    const res = await controller.handle(r, { 'x-noonlight-signature': sign(r, 'hex') });
    expect(res).toEqual({ received: true, applied: false });
    expect(handleNoonlightWebhook).not.toHaveBeenCalled();
  });

  it('honours a custom signature header name', async () => {
    const { controller } = build({ NOONLIGHT_WEBHOOK_SIGNATURE_HEADER: 'X-Signature' });
    const r = req(payload);
    await expect(
      controller.handle(r, { 'x-signature': sign(r, 'hex') }),
    ).resolves.toMatchObject({ received: true });
  });
});
