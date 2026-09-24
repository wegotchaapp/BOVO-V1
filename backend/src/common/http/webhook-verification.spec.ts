import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { getExpectedTwilioSignature } from 'twilio';
import { PaymentsController } from '../../modules/payments/payments.controller';
import { PaymentsService } from '../../modules/payments/payments.service';
import { StripeConnectWebhookController } from '../../modules/payments/stripe-connect-webhook.controller';
import { StripeConnectService } from '../../modules/payments/stripe-connect.service';
import { TwilioWebhookController } from '../../modules/emergency-contacts/twilio-webhook.controller';
import { EmergencyContactsService } from '../../modules/auth/emergency-contacts.service';
import { User } from '../../database/entities/user.entity';
import { registerBodyParsers } from './webhook-body-parsers';

describe('provider signature enforcement over HTTP', () => {
  let app: INestApplication;
  let base: string;
  let config: Record<string, string>;
  const stripe = new Stripe('sk_test_synthetic_only');
  const paymentEvent = jest.fn();
  const connectEvent = jest.fn();
  const optOut = jest.fn();
  beforeEach(async () => {
    jest.clearAllMocks();
    config = {
      STRIPE_SECRET_KEY: 'sk_test_synthetic_only',
      STRIPE_WEBHOOK_SECRET: 'whsec_synthetic_platform',
      STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_synthetic_connect',
      TWILIO_AUTH_TOKEN: 'synthetic_twilio_token',
      TWILIO_WEBHOOK_BASE_URL: 'https://hooks.example.test',
    };
    const module = await Test.createTestingModule({
      controllers: [PaymentsController, StripeConnectWebhookController, TwilioWebhookController],
      providers: [
        { provide: ConfigService, useValue: { get: (key: string) => config[key] } },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: PaymentsService, useValue: { handleWebhook: paymentEvent } },
        { provide: StripeConnectService, useValue: { handleWebhookAccountUpdated: connectEvent } },
        { provide: EmergencyContactsService, useValue: { handleOptOut: optOut } },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false, rawBody: true });
    registerBodyParsers(app);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });
  afterEach(async () => { await app?.close(); });
  const payload = '{ "id": "evt_synthetic", "type": "account.updated", "data": { "object": { "id": "acct_synthetic" } } }';
  async function sendStripe(path: string, secret: string, body = payload, signedBody = payload) {
    return fetch(base + path, { method: 'POST', headers: {
      'content-type': 'application/json',
      'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload: signedBody, secret }),
    }, body });
  }
  it.each([
    ['/payments/webhook', 'STRIPE_WEBHOOK_SECRET'],
    ['/webhooks/stripe-connect', 'STRIPE_CONNECT_WEBHOOK_SECRET'],
  ])('accepts exact signed bytes, rejects modified bytes for %s', async (path, key) => {
    expect((await sendStripe(path, config[key])).status).toBe(200);
    expect((await sendStripe(path, config[key], JSON.stringify(JSON.parse(payload)))).status).toBe(400);
    expect(paymentEvent.mock.calls.length + connectEvent.mock.calls.length).toBe(1);
  });
  it('rejects a signature for the other Stripe endpoint', async () => {
    expect((await sendStripe('/payments/webhook', config.STRIPE_CONNECT_WEBHOOK_SECRET)).status).toBe(400);
    expect(paymentEvent).not.toHaveBeenCalled();
  });
  it('rejects missing Stripe signatures', async () => {
    const response = await fetch(base + '/payments/webhook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload });
    expect(response.status).toBe(400);
    expect(paymentEvent).not.toHaveBeenCalled();
  });
  it('fails closed when the platform webhook secret is absent', async () => {
    (app.get(PaymentsController) as any).webhookSecret = '';
    expect((await sendStripe('/payments/webhook', config.STRIPE_WEBHOOK_SECRET)).status).toBe(500);
    expect(paymentEvent).not.toHaveBeenCalled();
  });
  it('fails closed when the Connect webhook secret is absent', async () => {
    (app.get(StripeConnectWebhookController) as any).webhookSecret = '';
    expect((await sendStripe('/webhooks/stripe-connect', config.STRIPE_CONNECT_WEBHOOK_SECRET)).status).toBe(500);
    expect(connectEvent).not.toHaveBeenCalled();
  });
  it('allows only signed Twilio form content using the configured public origin', async () => {
    const path = '/webhooks/twilio/opt-out';
    const body = { From: '+15555550123', Body: 'STOP' };
    const signature = getExpectedTwilioSignature(config.TWILIO_AUTH_TOKEN, config.TWILIO_WEBHOOK_BASE_URL + path, body);
    const send = (params: Record<string, string>, signed = signature) => fetch(base + path, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': signed, 'x-forwarded-host': 'attacker.example' }, body: new URLSearchParams(params).toString(),
    });
    expect((await send(body)).status).toBe(200);
    expect((await send({ ...body, From: '+15555550999' })).status).toBe(401);
    expect((await send(body, '')).status).toBe(401);
    expect(optOut).toHaveBeenCalledTimes(1);
    config.TWILIO_AUTH_TOKEN = '';
    expect((await send(body)).status).toBe(500);
    expect(optOut).toHaveBeenCalledTimes(1);
  });
});
