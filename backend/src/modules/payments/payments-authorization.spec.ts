import { ExecutionContext, INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { User } from '../../database/entities/user.entity';

describe('payment route authorization', () => {
  let app: INestApplication;
  let base: string;
  const execute = jest.fn(async (id: string) => ({ id }));
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: { executePayout: execute } },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: ConfigService, useValue: { get: () => 'sk_test_synthetic_only' } },
      ],
    }).overrideGuard(AuthGuard('jwt')).useValue({
      canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: { sub: string; role: string } }>();
        const role = req.headers['x-test-role'];
        if (!role) throw new UnauthorizedException();
        req.user = { sub: 'synthetic-user', role };
        return true;
      },
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => execute.mockClear());

  it('rejects anonymous payout execution before calling the payment service', async () => {
    const response = await fetch(`${base}/payments/payouts/test-id/execute`, { method: 'POST' });
    expect(response.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });
  it('rejects an authenticated non-admin before any payout', async () => {
    const response = await fetch(`${base}/payments/payouts/test-id/execute`, {
      method: 'POST', headers: { 'x-test-role': 'driver' },
    });
    expect(response.status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });
  it('allows a server-authenticated administrator', async () => {
    const response = await fetch(`${base}/payments/payouts/test-id/execute`, {
      method: 'POST', headers: { 'x-test-role': 'admin' },
    });
    expect(response.status).toBe(201);
    expect(execute).toHaveBeenCalledWith('test-id');
  });
  it.each([
    ['GET', 'my-payouts'], ['GET', 'my-earnings'],
    ['POST', 'connect/onboard'], ['GET', 'connect/status'],
    ['POST', 'connect/refresh'], ['GET', 'connect/dashboard-link'],
    ['POST', 'tax/w9-submit'], ['GET', 'tax/1099k-status'],
  ])('requires authentication for %s %s', async (method, path) => {
    expect((await fetch(`${base}/payments/${path}`, { method })).status).toBe(401);
  });
});
