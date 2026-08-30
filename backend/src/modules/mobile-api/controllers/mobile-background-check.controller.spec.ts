import { UnauthorizedException } from '@nestjs/common';

import { MobileBackgroundCheckController } from './mobile-background-check.controller';

describe('MobileBackgroundCheckController webhook', () => {
  const payload = { id: 'evt_1' };

  it('passes the untouched raw body to signature validation before processing', () => {
    const checks = {
      isValidWebhookSignature: jest.fn().mockReturnValue(true),
      handleWebhook: jest.fn().mockReturnValue({ ok: true }),
    };
    const controller = new MobileBackgroundCheckController(checks as never);
    const rawBody = Buffer.from(JSON.stringify(payload));

    expect(
      controller.webhook({ rawBody } as never, 'signature', payload),
    ).toEqual({ ok: true });
    expect(checks.isValidWebhookSignature).toHaveBeenCalledWith(
      rawBody,
      'signature',
    );
    expect(checks.handleWebhook).toHaveBeenCalledWith(payload);
  });

  it('rejects invalid callbacks before they reach the service', () => {
    const checks = {
      isValidWebhookSignature: jest.fn().mockReturnValue(false),
      handleWebhook: jest.fn(),
    };
    const controller = new MobileBackgroundCheckController(checks as never);

    expect(() => controller.webhook({} as never, undefined, payload)).toThrow(
      UnauthorizedException,
    );
    expect(checks.handleWebhook).not.toHaveBeenCalled();
  });
});
