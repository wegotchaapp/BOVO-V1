import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';

import { CheckrWebhookController } from './checkr-webhook.controller';

describe('CheckrWebhookController', () => {
  const originalSecret = process.env.CHECKR_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.CHECKR_WEBHOOK_SECRET = 'checkr-webhook-test-secret';
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.CHECKR_WEBHOOK_SECRET;
    } else {
      process.env.CHECKR_WEBHOOK_SECRET = originalSecret;
    }
  });

  it('accepts only a signature computed over the received bytes', async () => {
    const checks = { handleWebhookReportCompleted: jest.fn() };
    const controller = new CheckrWebhookController(checks as never);
    const body = {
      type: 'report.completed',
      data: {
        id: 'report_1',
        candidate_id: 'candidate_1',
        status: 'clear',
      },
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = createHmac('sha256', 'checkr-webhook-test-secret')
      .update(rawBody)
      .digest('hex');

    await expect(
      controller.handleWebhook({ rawBody } as never, body, signature),
    ).resolves.toEqual({ received: true });
    expect(checks.handleWebhookReportCompleted).toHaveBeenCalledWith(
      'report_1',
      'candidate_1',
      'clear',
      undefined,
    );
  });

  it('fails closed when a raw body or signature is unavailable', async () => {
    const checks = { handleWebhookReportCompleted: jest.fn() };
    const controller = new CheckrWebhookController(checks as never);

    await expect(
      controller.handleWebhook({} as never, {
        type: 'candidate.completed',
        data: { id: 'candidate_1' },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(checks.handleWebhookReportCompleted).not.toHaveBeenCalled();
  });
});
