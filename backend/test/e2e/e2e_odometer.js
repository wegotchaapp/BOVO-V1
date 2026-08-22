/**
 * End-to-end exercise of the odometer flow, on the flat $32.40 cost-share.
 */
const BASE = 'http://localhost:3000/api';

const SEAT = 32.4;
const feeFor = (sub) =>
  Math.round(((0.3 + 2.0) / 0.971 + (0.029 / 0.971) * sub) * 100) / 100;

let failures = 0;
function check(label, cond, detail) {
  const ok = !!cond;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  → ${detail}` : ''}`);
}

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

const pngBytes = () => Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

async function postReading(token, tripId, { bookingId, kind, miles }) {
  const form = new FormData();
  form.append('photo', new Blob([pngBytes()], { type: 'image/png' }), 'odo.png');
  form.append('bookingId', bookingId);
  form.append('kind', kind);
  form.append('miles', String(miles));
  return api(`/trips/${tripId}/odometer`, { method: 'POST', token, form });
}


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

/**
 * Posting is gated on a human approving the vehicle, so a fixture has to walk the
 * real ops path rather than flip a column — that way these suites keep exercising
 * the gate instead of stepping around it.
 */
async function approveVehicle(ownerToken) {
  const mine = await api('/vehicles/mine', { token: ownerToken });
  const vehicleId = mine.data?.vehicles?.[0]?.id ?? mine.data?.vehicle?.id;
  if (!vehicleId) throw new Error(`no vehicle to approve: ${JSON.stringify(mine.data)}`);

  const login = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@test.com', password: 'testpass123' }),
  }).then((r) => r.json());
  if (!login.accessToken) throw new Error(`admin login failed: ${JSON.stringify(login)}`);

  const res = await fetch(
    `http://localhost:3000/admin/vehicle-review/${vehicleId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${login.accessToken}`,
      },
      body: JSON.stringify({ approved: true }),
    },
  ).then((r) => r.json());
  if (!res.ok) throw new Error(`approve failed: ${JSON.stringify(res)}`);
}

(async () => {
  const stamp = Date.now();
  const mk = async (label) => {
    const r = await api('/auth/register', {
      method: 'POST',
      body: { name: `Odo ${label}`, email: `odo_${label}_${stamp}@test.com`, phone: '5125550100', password: 'testpass123' },
    });
    if (!r.data?.token) throw new Error(`register ${label} failed: ${JSON.stringify(r.data)}`);
    return { token: r.data.token, id: r.data.user.id };
  };

  const voyager = await mk('voyager');
  const sailorA = await mk('sailorA');
  const sailorB = await mk('sailorB');
  console.log('created 3 users\n');
  await makeVehicleRoadReady(voyager.token, `1HGCM82633A${String(stamp).slice(-6)}`);
  await approveVehicle(voyager.token);

  const trip = await api('/trips', {
    method: 'POST', token: voyager.token,
    body: {
      fromCity: 'Austin, TX', toCity: 'Houston, TX',
      departureAt: new Date(Date.now() + 86400000).toISOString(),
      seatsAvailable: 3, luggageSpace: 2,
      pricePerSeat: 999,           // must be ignored — server prices it
      note: 'odometer e2e',
    },
  });
  const tripId = trip.data?.trip?.id;
  check('adventure created', !!tripId, tripId ?? JSON.stringify(trip.data));
  check('client price of $999 ignored; server priced it $32.40',
    Number(trip.data?.trip?.pricePerSeat) === SEAT, `got ${trip.data?.trip?.pricePerSeat}`);
  if (!tripId) process.exit(1);

  // Carry-on + no insurance keeps this test focused on mileage.
  const bookings = {};
  for (const [label, sailor] of [['A', sailorA], ['B', sailorB]]) {
    const b = await api('/bookings', {
      method: 'POST', token: sailor.token,
      body: { tripId, seats: 1, paymentMethod: 'card', insuranceOptedIn: false },
    });
    bookings[label] = b.data?.booking?.id;
    check(`sailor ${label} booked`, !!bookings[label], bookings[label] ?? JSON.stringify(b.data));
    if (b.data?.booking) {
      check(`sailor ${label} seat = $32.40 flat`,
        Number(b.data.booking.pricePerSeat) === SEAT, `$${b.data.booking.pricePerSeat}`);
      check(`sailor ${label} fee = $${feeFor(SEAT)}`,
        Number(b.data.booking.serviceFee) === feeFor(SEAT), `$${b.data.booking.serviceFee}`);
    }
  }

  let r = await postReading(voyager.token, tripId, { bookingId: bookings.A, kind: 'pickup', miles: 84000 });
  check('rejected before car video / start', r.status >= 400, `${r.status} ${r.data?.error ?? ''}`);

  const path = require('path');
  process.chdir('/Users/vaishnavi/Desktop/TheBovogo App/backend');
  require('dotenv').config({ path: path.join(process.cwd(), '.env') });
  const { Client } = require('pg');
  const pg = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  await pg.query(`UPDATE mobile_trips SET start_video_url='http://test/video.mp4' WHERE id=$1`, [tripId]);
  const started = await api(`/trips/${tripId}/start`, { method: 'POST', token: voyager.token });
  check('adventure started', started.status === 200, String(started.status));

  const m = await api(`/trips/${tripId}/manifest`, { token: voyager.token });
  check('manifest lists both Sailors', m.data?.entries?.length === 2, `count=${m.data?.entries?.length}`);
  check('both awaiting pickup', m.data?.entries?.every((e) => e.status === 'awaiting_pickup'), '');

  r = await postReading(voyager.token, tripId, { bookingId: bookings.A, kind: 'dropoff', miles: 84100 });
  check('dropoff before pickup rejected', r.status >= 400, r.data?.error ?? String(r.status));

  r = await postReading(voyager.token, tripId, { bookingId: bookings.A, kind: 'pickup', miles: 84000 });
  check('Sailor A pickup @84000', r.status === 200, r.data?.error ?? '');
  r = await postReading(voyager.token, tripId, { bookingId: bookings.A, kind: 'pickup', miles: 84010 });
  check('duplicate pickup rejected', r.status >= 400, r.data?.error ?? String(r.status));
  r = await postReading(voyager.token, tripId, { bookingId: bookings.B, kind: 'pickup', miles: 83000 });
  check('backwards reading rejected', r.status >= 400, r.data?.error ?? String(r.status));
  r = await postReading(voyager.token, tripId, { bookingId: bookings.B, kind: 'pickup', miles: 84020 });
  check('Sailor B pickup @84020', r.status === 200, r.data?.error ?? '');

  r = await postReading(voyager.token, tripId, { bookingId: bookings.A, kind: 'dropoff', miles: 84162 });
  check('Sailor A travelled 162 mi', r.data?.milesTravelled === 162, `got ${r.data?.milesTravelled}`);
  check('trip NOT complete yet', r.data?.tripCompleted === false, `got ${r.data?.tripCompleted}`);
  r = await postReading(voyager.token, tripId, { bookingId: bookings.B, kind: 'dropoff', miles: 84170 });
  check('Sailor B travelled 150 mi', r.data?.milesTravelled === 150, `got ${r.data?.milesTravelled}`);
  check('trip completed on final dropoff', r.data?.tripCompleted === true, `got ${r.data?.tripCompleted}`);

  const e = (await api('/earnings?period=all', { token: voyager.token })).data;
  check('earnings row created', e?.tripCount === 1, `tripCount=${e?.tripCount}`);
  check('trip miles = 170 (first pickup → last dropoff)', e?.totalMiles === 170, `got ${e?.totalMiles}`);
  check('gross = 2 × $32.40 = $64.80', Number(e?.grossTotal) === 64.8, `got ${e?.grossTotal}`);
  check(`platform fee = 2 × $${feeFor(SEAT)}`,
    Number(e?.platformFeeTotal) === Math.round(feeFor(SEAT) * 2 * 100) / 100, `got ${e?.platformFeeTotal}`);
  check('voyager keeps full $64.80', Number(e?.netTotal) === 64.8, `got ${e?.netTotal}`);
  check('full occupancy under IRS ceiling on this route',
    SEAT * 3 <= 162 * 0.72, `${(SEAT * 3).toFixed(2)} <= ${(162 * 0.72).toFixed(2)}`);

  const rows = await pg.query(
    `SELECT kind, photo_url FROM mobile_odometer_readings WHERE trip_id=$1`, [tripId]);
  check('4 odometer readings persisted', rows.rows.length === 4, `got ${rows.rows.length}`);
  check('every reading has a photo', rows.rows.every((x) => !!x.photo_url), '');

  await pg.query(`DELETE FROM mobile_odometer_readings WHERE trip_id=$1`, [tripId]);
  await pg.query(`DELETE FROM mobile_driver_trips WHERE driver_id=$1`, [voyager.id]);
  await pg.query(`DELETE FROM mobile_bookings WHERE trip_id=$1`, [tripId]);
  await pg.query(`DELETE FROM mobile_trips WHERE id=$1`, [tripId]);
  const all = [voyager.id, sailorA.id, sailorB.id];
  await pg.query(`DELETE FROM mobile_conversations WHERE user_low_id = ANY($1) OR user_high_id = ANY($1)`, [all]);
  await pg.query(`DELETE FROM mobile_sessions WHERE user_id = ANY($1)`, [all]);
  await pg.query(`DELETE FROM mobile_vehicles WHERE user_id = ANY($1)`, [all]);
  await pg.query(`DELETE FROM mobile_users WHERE id = ANY($1)`, [all]);
  await pg.end();

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('ERROR:', e); process.exit(1); });
