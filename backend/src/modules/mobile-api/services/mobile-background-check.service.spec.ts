import { createHmac } from 'crypto';

import { MobileBackgroundCheckService } from './mobile-background-check.service';

const API_KEY = 'checkr_test_key';

function build() {
  const config = {
    get: (key: string) =>
      ({ CHECKR_API_KEY: API_KEY, CHECKR_API_URL: 'https://example.test' })[
        key
      ],
  };
  const logger = { error: jest.fn(), warn: jest.fn() };
  const users = { findOne: jest.fn(), save: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const service = new MobileBackgroundCheckService(
    config as never,
    logger as never,
    users as never,
    dataSource as never,
  );
  return { service, dataSource, users };
}

describe('MobileBackgroundCheckService webhook verification', () => {
  const payload = {
    id: 'evt_checkr_1',
    type: 'report.completed',
    data: { object: { candidate_id: 'candidate_1', status: 'clear' } },
  };

  it('accepts the Checkr HMAC only for the exact received bytes', () => {
    const { service } = build();
    const raw = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha256', API_KEY).update(raw).digest('hex');

    expect(service.isValidWebhookSignature(raw, signature)).toBe(true);
    expect(
      service.isValidWebhookSignature(
        Buffer.from('{"id":"tampered"}'),
        signature,
      ),
    ).toBe(false);
    expect(service.isValidWebhookSignature(raw, undefined)).toBe(false);
  });

  it('does not reapply a duplicate event', async () => {
    const { service, dataSource, users } = build();
    const manager = {
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn().mockReturnValue(users),
    };
    dataSource.transaction.mockImplementation(
      (work: (transactionManager: typeof manager) => unknown) => work(manager),
    );

    await expect(service.handleWebhook(payload)).resolves.toEqual({
      ok: true,
      duplicate: true,
    });
    expect(users.findOne).not.toHaveBeenCalled();
    expect(users.save).not.toHaveBeenCalled();
  });

  it('stores the event before applying a valid result', async () => {
    const { service, dataSource, users } = build();
    const user = {
      id: 'user_1',
      background_check_status: 'pending',
      ssn_verified: false,
      ssn_last4: null,
      background_check_completed_at: null,
    };
    const manager = {
      query: jest.fn().mockResolvedValue([{ event_id: payload.id }]),
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(user),
        save: users.save,
      }),
    };
    dataSource.transaction.mockImplementation(
      (work: (transactionManager: typeof manager) => unknown) => work(manager),
    );

    await expect(service.handleWebhook(payload)).resolves.toEqual({ ok: true });
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT ("event_id") DO NOTHING'),
      [payload.id, 'candidate_1', 'report.completed'],
    );
    expect(user.background_check_status).toBe('clear');
    expect(user.ssn_verified).toBe(true);
    expect(users.save).toHaveBeenCalledWith(user);
  });
});
