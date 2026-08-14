/**
 * Exercises luggage surcharges + trip/luggage insurance through the real API,
 * asserting the money splits match the pricing spec.
 */
const BASE = 'http://localhost:3000/api';

let failures = 0;
const check = (label, cond, detail) => {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  → ${detail}` : ''}`);
};

async function api(path, { method = 'GET', token, body, form } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const SEAT = 32.4;             // flat cost-share, every route
const INSURANCE = 15.0;        // per seat
const FEE_FIXED = 2.3, FEE_RATE = 0.029 / 0.971;
const feeFor = (sub) => Math.round(((0.3 + 2.0) / 0.971 + FEE_RATE * sub) * 100) / 100;
const r2 = (n) => Math.round(n * 100) / 100;


// A Voyager must have a fully documented vehicle before posting. Kept here so
// these suites exercise the real gate rather than bypassing it.
const _png = () => Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');
async function makeVehicleRoadReady(token, vin) {
  await api('/vehicles', { method: 'POST', token, body: {
    make: 'Honda', model: 'Civic', year: 2022, color: 'White',
    licensePlate: 'ABC-1234', state: 'TX', seatCount: 3, doorCount: 4, vin,
  }});
  for (const slot of ['front', 'rear', 'left', 'right', 'interior']) {
    const f = new FormData();
    f.append('photo', new Blob([_png()], { type: 'image/png' }), 'p.png');
    f.append('slot', slot);
    await api('/vehicles/photo', { method: 'POST', token, form: f });
  }
  for (const kind of ['insurance', 'registration']) {
    const f = new FormData();
    f.append('document', new Blob([_png()], { type: 'image/png' }), 'd.png');
    f.append('kind', kind);
    await api('/vehicles/document', { method: 'POST', token, form: f });
  }
}

(async () => {
  const stamp = Date.now();
  const mk = async (label) => {
    const r = await api('/auth/register', {
      method: 'POST',
      body: {
        name: `Lug ${label}`,
        email: `lug_${label}_${stamp}@test.com`,
        phone: '5125550100',
        password: 'testpass123',
      },
    });
    if (!r.data?.token) throw new Error(`register ${label}: ${JSON.stringify(r.data)}`);
    return { token: r.data.token, id: r.data.user.id };
  };

  const voyager = await mk('v');
  await makeVehicleRoadReady(voyager.token, '5YJ3E1EA7HF000337');
  const trip = await api('/trips', {
    method: 'POST', token: voyager.token,
    body: {
      fromCity: 'Austin, TX', toCity: 'Houston, TX',
      departureAt: new Date(Date.now() + 86400000).toISOString(),
      seatsAvailable: 4, luggageSpace: 4, pricePerSeat: 0, note: 'luggage e2e',
    },
  });
  const tripId = trip.data?.trip?.id;
  check('adventure created', !!tripId, tripId ?? JSON.stringify(trip.data));
  if (!tripId) process.exit(1);

  const sailorIds = [];
  const cases = [
    { label: 'carry-on, insurance ON (default)',  body: {},
      tier: 'carry_on',  surcharge: 0, insurance: INSURANCE, cover: 0 },
    { label: 'standard bags, insurance ON',        body: { luggageTier: 'standard' },
      tier: 'standard',  surcharge: 3, insurance: INSURANCE, cover: 0 },
    { label: 'large bags + cover, insurance OFF',  body: { luggageTier: 'large', insuranceOptedIn: false, luggageInsuranceOptedIn: true },
      tier: 'large',     surcharge: 6, insurance: 0,         cover: 5 },
    { label: 'oversized + cover, insurance ON',    body: { luggageTier: 'oversized', luggageInsuranceOptedIn: true },
      tier: 'oversized', surcharge: 8, insurance: INSURANCE, cover: 8 },
  ];

  for (const c of cases) {
    const s = await mk(`s${cases.indexOf(c)}`);
    sailorIds.push(s.id);
    const res = await api('/bookings', {
      method: 'POST', token: s.token,
      body: { tripId, seats: 1, paymentMethod: 'card', ...c.body },
    });
    const b = res.data?.booking;
    if (!b) { check(c.label, false, JSON.stringify(res.data)); continue; }

    const expSub = r2(SEAT + c.surcharge + c.insurance + c.cover);
    const expFee = feeFor(expSub);
    const expTotal = r2(expSub + expFee);

    console.log(`\n${c.label}`);
    check('  tier stored', b.luggageTier === c.tier, b.luggageTier);
    check('  surcharge', Number(b.luggageSurcharge) === c.surcharge, `$${b.luggageSurcharge}`);
    check('  insurance premium', Number(b.insurancePremium) === c.insurance, `$${b.insurancePremium}`);
    check('  insurance flag', b.insuranceOptedIn === (c.insurance > 0), String(b.insuranceOptedIn));
    check('  luggage cover', Number(b.luggageInsurancePremium) === c.cover, `$${b.luggageInsurancePremium}`);
    check('  service fee', Number(b.serviceFee) === expFee, `$${b.serviceFee} (want $${expFee})`);
    check('  total', Number(b.totalAmount) === expTotal, `$${b.totalAmount} (want $${expTotal})`);

    // Spec: surcharge goes 100% to the Voyager; Bovogo keeps fee + commissions.
    const stripe = r2(0.029 * expTotal + 0.3);
    const bovogo = r2(expFee + c.insurance * 0.25 + c.cover * 0.2 - stripe);
    console.log(
      `   voyager gets $${r2(SEAT + c.surcharge).toFixed(2)} | ` +
      `bovogo nets $${bovogo.toFixed(2)} | stripe $${stripe.toFixed(2)}`,
    );
    check('  bovogo net positive', bovogo > 0, `$${bovogo.toFixed(2)}`);
  }

  // Cleanup
  const path = require('path');
  process.chdir('/Users/vaishnavi/Desktop/TheBovogo App/backend');
  require('dotenv').config({ path: path.join(process.cwd(), '.env') });
  const { Client } = require('pg');
  const pg = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query(`DELETE FROM mobile_bookings WHERE trip_id=$1`, [tripId]);
  await pg.query(`DELETE FROM mobile_trips WHERE id=$1`, [tripId]);
  const all = [voyager.id, ...sailorIds];
  await pg.query(`DELETE FROM mobile_conversations WHERE user_low_id = ANY($1) OR user_high_id = ANY($1)`, [all]);
  await pg.query(`DELETE FROM mobile_sessions WHERE user_id = ANY($1)`, [all]);
  await pg.query(`DELETE FROM mobile_vehicles WHERE user_id = ANY($1)`, [all]);
  await pg.query(`DELETE FROM mobile_users WHERE id = ANY($1)`, [all]);
  await pg.end();

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('ERROR:', e); process.exit(1); });
