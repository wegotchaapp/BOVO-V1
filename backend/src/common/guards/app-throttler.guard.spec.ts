import {
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard, isUnthrottledPath } from './app-throttler.guard';
import { AuthController } from '../../modules/auth/auth.controller';
import { AuthService } from '../../modules/auth/auth.service';
import { MobileAuthController } from '../../modules/mobile-api/controllers/mobile-auth.controller';
import { MobileAuthGuard } from '../../modules/mobile-api/mobile-auth.guard';
import { MobileAuthService } from '../../modules/mobile-api/services/mobile-auth.service';

/**
 * Stands in for a signature-authenticated provider callback. Mounted under the
 * `/webhooks/` prefix with a limit of one so that "was it skipped?" is
 * unambiguous over real HTTP.
 */
@Controller('webhooks')
class ProbeWebhookController {
  @Get('test-probe')
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  probe() {
    return { ok: true };
  }
}

const authService = {
  login: jest.fn(async () => ({ access_token: 'synthetic' })),
  verifyOtp: jest.fn(async () => ({ verified: true })),
  forgotPassword: jest.fn(async () => undefined),
};

const mobileAuthService = {
  login: jest.fn(async () => ({ token: 'synthetic' })),
};

/**
 * A fresh app per scenario means a fresh in-memory ThrottlerStorage, so the
 * buckets one test fills cannot leak into the next.
 */
async function createApp(): Promise<{ app: INestApplication; base: string }> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 600 }]),
    ],
    controllers: [AuthController, MobileAuthController, ProbeWebhookController],
    providers: [
      { provide: AuthService, useValue: authService },
      { provide: MobileAuthService, useValue: mobileAuthService },
      { provide: APP_GUARD, useClass: AppThrottlerGuard },
    ],
  }).overrideGuard(MobileAuthGuard).useValue({ canActivate: () => true }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  return { app, base: await app.getUrl() };
}

async function post(
  base: string,
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ email: 'probe@example.test', password: 'probe' }),
  });
}

/** Sends `count` requests and returns the status codes in order. */
async function burst(
  base: string,
  path: string,
  count: number,
  headers: Record<string, string> = {},
): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < count; i += 1) {
    statuses.push((await post(base, path, headers)).status);
  }
  return statuses;
}

describe('AppThrottlerGuard over real HTTP', () => {
  let app: INestApplication;
  let base: string;

  beforeEach(async () => {
    delete process.env.TRUST_PROXY_HOPS;
    jest.clearAllMocks();
    ({ app, base } = await createApp());
  });

  afterEach(async () => {
    await app?.close();
    delete process.env.TRUST_PROXY_HOPS;
  });

  it('answers 429 once /auth/login passes its declared limit', async () => {
    const statuses = await burst(base, '/auth/login', 11);

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(statuses[10]).toBe(429);
    // The 11th attempt must not reach credential checking at all.
    expect(authService.login).toHaveBeenCalledTimes(10);
  });

  it('sets Retry-After on the throttled login response', async () => {
    await burst(base, '/auth/login', 10);
    const blocked = await post(base, '/auth/login');

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
  });

  it('throttles the mobile /api/auth/login door too', async () => {
    const statuses = await burst(base, '/api/auth/login', 11);

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(statuses[10]).toBe(429);
    expect(mobileAuthService.login).toHaveBeenCalledTimes(10);
  });

  it('keeps the mobile error envelope on a 429', async () => {
    await burst(base, '/api/auth/login', 10);
    const blocked = await post(base, '/api/auth/login');

    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toEqual({
      error: expect.stringContaining('ThrottlerException'),
    });
  });

  it('answers 429 once OTP verification passes its limit', async () => {
    const statuses = await burst(base, '/auth/otp/verify', 11);

    expect(statuses[9]).not.toBe(429);
    expect(statuses[10]).toBe(429);
    expect(authService.verifyOtp).toHaveBeenCalledTimes(10);
  });

  it('answers 429 once password reset requests pass their limit', async () => {
    const statuses = await burst(base, '/auth/forgot-password', 6);

    expect(statuses[4]).not.toBe(429);
    expect(statuses[5]).toBe(429);
    expect(authService.forgotPassword).toHaveBeenCalledTimes(5);
  });

  it('does not throttle signature-authenticated webhook paths', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      statuses.push((await fetch(`${base}/webhooks/test-probe`)).status);
    }

    // A limit of 1 would have blocked request 2 had the skip not applied.
    expect(statuses.every((status) => status === 200)).toBe(true);
  });
});

describe('AppThrottlerGuard proxy trust', () => {
  let app: INestApplication;
  let base: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    ({ app, base } = await createApp());
  });

  afterEach(async () => {
    await app?.close();
    delete process.env.TRUST_PROXY_HOPS;
  });

  it('ignores X-Forwarded-For when no proxy is trusted', async () => {
    delete process.env.TRUST_PROXY_HOPS;

    for (let i = 0; i < 10; i += 1) {
      await post(base, '/auth/login', { 'x-forwarded-for': `10.0.0.${i}` });
    }
    // A brand-new claimed address must not buy an 11th attempt.
    const blocked = await post(base, '/auth/login', {
      'x-forwarded-for': '10.0.0.250',
    });

    expect(blocked.status).toBe(429);
  });

  it('buckets on the trusted hop, not the caller-supplied prefix', async () => {
    process.env.TRUST_PROXY_HOPS = '1';

    // Right-most entry is what our own proxy appended; everything left of it
    // is attacker-controlled and must not change the bucket.
    for (let i = 0; i < 10; i += 1) {
      await post(base, '/auth/login', {
        'x-forwarded-for': `203.0.113.${i}, 198.51.100.7`,
      });
    }
    const spoofed = await post(base, '/auth/login', {
      'x-forwarded-for': '203.0.113.250, 198.51.100.7',
    });

    expect(spoofed.status).toBe(429);
  });

  it('gives a genuinely different client its own bucket', async () => {
    process.env.TRUST_PROXY_HOPS = '1';

    for (let i = 0; i < 10; i += 1) {
      await post(base, '/auth/login', { 'x-forwarded-for': '198.51.100.7' });
    }
    const otherClient = await post(base, '/auth/login', {
      'x-forwarded-for': '198.51.100.8',
    });

    expect(otherClient.status).toBe(200);
  });
});

describe('AppThrottlerGuard transport safety', () => {
  function guard(): AppThrottlerGuard {
    return new AppThrottlerGuard(
      [{ name: 'default', ttl: 60_000, limit: 600 }],
      { increment: jest.fn() } as any,
      new Reflector(),
    );
  }

  it('skips non-HTTP contexts without reaching for a request', async () => {
    const wsContext = {
      getType: () => 'ws',
      switchToHttp: () => {
        throw new Error('websocket contexts have no HTTP request');
      },
    } as unknown as ExecutionContext;

    await expect(
      (guard() as any).shouldSkip(wsContext),
    ).resolves.toBe(true);
  });

  it.each([
    ['/health', true],
    ['/health/ready', true],
    ['/webhooks/stripe-connect', true],
    ['/webhooks/twilio/status', true],
    ['/payments/webhook', true],
    ['/safety/noonlight/webhook', true],
    ['/api/background-check/webhook', true],
    ['/auth/login', false],
    ['/api/auth/login', false],
    ['/payments/subscription/confirm', false],
    // Caller-chosen paths that merely begin with an exempt prefix. No route
    // serves them, but an unthrottled 404 is still an unthrottled request.
    ['/healthz-flood', false],
    ['/payments/webhook-probe', false],
    ['/webhooksomething', false],
    ['/safety/noonlight/webhookx', false],
  ])('classifies %s as unthrottled=%s', (path, expected) => {
    expect(isUnthrottledPath(path)).toBe(expected);
  });
});
