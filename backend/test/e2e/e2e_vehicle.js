/**
 * Item 6: vehicle completeness gate. Walks a Voyager from nothing to
 * road-ready, asserting the API refuses to let them post until every
 * requirement is met, then checks the rules for a second vehicle.
 */
const BASE = 'http://localhost:3000/api';

let failures = 0;
const check = (l, c, d) => {
  if (!c) failures++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${d ? `  → ${d}` : ''}`);
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

const png = () => Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

async function uploadPhoto(token, vehicleId, slot) {
  const form = new FormData();
  form.append('photo', new Blob([png()], { type: 'image/png' }), `${slot}.png`);
  form.append('slot', slot);
  return api(`/vehicles/${vehicleId}/photo`, { method: 'POST', token, form });
}
async function uploadDoc(token, vehicleId, kind) {
  const form = new FormData();
  form.append('document', new Blob([png()], { type: 'image/png' }), `${kind}.png`);
  form.append('kind', kind);
  return api(`/vehicles/${vehicleId}/document`, { method: 'POST', token, form });
}

const tripBody = (extra = {}) => ({
  fromCity: 'Austin, TX', toCity: 'Houston, TX',
  departureAt: new Date(Date.now() + 86400000).toISOString(),
  seatsAvailable: 3, luggageSpace: 2, pricePerSeat: 0, note: 'vehicle gate e2e',
  ...extra,
});

const postAdventure = (token, extra = {}) =>
  api('/trips', { method: 'POST', token, body: tripBody(extra) });

const VALID_VIN = '1HGCM82633A004352';   // real-format Honda VIN
const OTHER_VIN = '5YJ3E1EA7HF000337';   // real-format Tesla VIN

(async () => {
  const stamp = Date.now();
  const mk = async (label) => {
    const r = await api('/auth/register', {
      method: 'POST',
      body: { name: `Veh ${label}`, email: `veh_${label}_${stamp}@test.com`, phone: '5125550100', password: 'testpass123' },
    });
    if (!r.data?.token) throw new Error(`register ${label}: ${JSON.stringify(r.data)}`);
    return { token: r.data.token, id: r.data.user.id };
  };

  const v = await mk('driver');
  const other = await mk('other');

  // ── Gate with no vehicle at all ─────────────────────────────────────────────
  let r = await postAdventure(v.token);
  check('cannot post with no vehicle', r.status >= 400, r.data?.error ?? String(r.status));

  // ── VIN validation ──────────────────────────────────────────────────────────
  const base = {
    make: 'Honda', model: 'Civic', year: 2022, color: 'White',
    licensePlate: 'ABC-1234', state: 'TX', seatCount: 3, doorCount: 4,
  };
  r = await api('/vehicles', { method: 'POST', token: v.token, body: { ...base, vin: '1HGCM82633A0043I5' } });
  check('VIN containing I rejected', r.status >= 400, r.data?.error ?? String(r.status));
  r = await api('/vehicles', { method: 'POST', token: v.token, body: { ...base, vin: 'TOOSHORT' } });
  check('short VIN rejected', r.status >= 400, r.data?.error ?? String(r.status));

  // ── Save valid details ──────────────────────────────────────────────────────
  r = await api('/vehicles', { method: 'POST', token: v.token, body: { ...base, vin: VALID_VIN } });
  check('valid VIN accepted', r.status === 200 || r.status === 201, r.data?.error ?? '');
  let veh = r.data?.vehicle;
  check('seats stored', veh?.seatCount === 3, `${veh?.seatCount}`);
  check('doors stored', veh?.doorCount === 4, `${veh?.doorCount}`);
  check('not complete yet', veh?.isComplete === false, `missing ${veh?.missingRequirements?.length}`);
  check('7 items outstanding (5 photos + 2 docs)',
    veh?.missingRequirements?.length === 7, JSON.stringify(veh?.missingRequirements));

  // ── VIN uniqueness ──────────────────────────────────────────────────────────
  r = await api('/vehicles', { method: 'POST', token: other.token, body: { ...base, vin: VALID_VIN } });
  check('same VIN on another account rejected', r.status >= 400, r.data?.error ?? String(r.status));
  r = await api('/vehicles', { method: 'POST', token: v.token, body: { ...base, vin: VALID_VIN } });
  check('same VIN twice on one account rejected', r.status >= 400, r.data?.error ?? String(r.status));

  // ── Still gated with details only ───────────────────────────────────────────
  r = await postAdventure(v.token);
  check('cannot post with details but no photos', r.status >= 400,
    (r.data?.error ?? '').slice(0, 70));

  // ── Photos ──────────────────────────────────────────────────────────────────
  r = await uploadPhoto(v.token, veh.id, 'roof');
  check('unknown photo slot rejected', r.status >= 400, r.data?.error ?? String(r.status));

  r = await uploadPhoto(other.token, veh.id, 'front');
  check("cannot upload to someone else's vehicle", r.status === 404, r.data?.error ?? String(r.status));

  for (const slot of ['front', 'rear', 'left', 'right', 'interior']) {
    r = await uploadPhoto(v.token, veh.id, slot);
    check(`photo ${slot} uploaded`, r.status === 200, r.data?.error ?? '');
    veh = r.data?.vehicle ?? veh;
  }
  check('photos recorded on vehicle',
    veh && Object.values(veh.photos).every(Boolean), JSON.stringify(veh?.photos && Object.keys(veh.photos)));
  check('2 items outstanding (docs)', veh?.missingRequirements?.length === 2,
    JSON.stringify(veh?.missingRequirements));

  // ── Still gated without documents ───────────────────────────────────────────
  r = await postAdventure(v.token);
  check('cannot post without documents', r.status >= 400, (r.data?.error ?? '').slice(0, 70));

  // ── Documents ───────────────────────────────────────────────────────────────
  r = await uploadDoc(v.token, veh.id, 'inspection');
  check('unknown document kind rejected', r.status >= 400, r.data?.error ?? String(r.status));

  r = await uploadDoc(v.token, veh.id, 'insurance');
  check('insurance uploaded', r.status === 200, r.data?.error ?? '');
  r = await uploadDoc(v.token, veh.id, 'registration');
  check('registration uploaded', r.status === 200, r.data?.error ?? '');
  veh = r.data?.vehicle ?? veh;

  check('vehicle now complete', veh?.isComplete === true, JSON.stringify(veh?.missingRequirements));
  check('moved to pending_review', veh?.verificationStatus === 'pending_review', veh?.verificationStatus);

  // ── Complete is not the same as approved ───────────────────────────────────
  // Sailors are told vehicles are checked before they ride, so having uploaded
  // the paperwork must not by itself open the gate.
  r = await postAdventure(v.token);
  check(
    'STILL cannot post while only pending_review',
    r.status >= 400,
    r.data?.error ?? `unexpectedly posted (${r.status})`,
  );

  // ── An ops decision opens it ───────────────────────────────────────────────
  const adminLogin = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@test.com', password: 'testpass123' }),
  }).then((x) => x.json());
  check('admin can sign in', !!adminLogin.accessToken, adminLogin.message ?? '');

  const noReason = await fetch(
    `http://localhost:3000/admin/vehicle-review/${veh.id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLogin.accessToken}`,
      },
      body: JSON.stringify({ approved: false }),
    },
  );
  check('rejection without a reason is refused', noReason.status >= 400, String(noReason.status));

  const approved = await fetch(
    `http://localhost:3000/admin/vehicle-review/${veh.id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminLogin.accessToken}`,
      },
      body: JSON.stringify({ approved: true }),
    },
  ).then((x) => x.json());
  check('ops approved the vehicle', approved?.verificationStatus === 'approved', JSON.stringify(approved));

  r = await postAdventure(v.token);
  const tripId = r.data?.trip?.id;
  check('CAN post once approved', !!tripId, tripId ?? JSON.stringify(r.data));

  // ── A second vehicle, and the approved one is locked ───────────────────────
  const secondDetails = { ...base, licensePlate: 'XYZ-9876', vin: OTHER_VIN };
  r = await api('/vehicles', { method: 'POST', token: v.token, body: secondDetails });
  check('a second vehicle can be registered', r.status === 200 || r.status === 201,
    r.data?.error ?? String(r.status));
  const second = r.data?.vehicle;

  r = await api(`/vehicles/${veh.id}`, {
    method: 'PUT', token: v.token, body: { ...base, vin: VALID_VIN },
  });
  check('approved vehicle cannot be edited', r.status === 403, r.data?.error ?? String(r.status));

  r = await api(`/vehicles/${second?.id}`, {
    method: 'PUT', token: v.token, body: { ...secondDetails, seatCount: 4 },
  });
  check('an unapproved vehicle can still be edited', r.status === 200, r.data?.error ?? String(r.status));
  check('the edit stuck', r.data?.vehicle?.seatCount === 4, String(r.data?.vehicle?.seatCount));

  r = await postAdventure(v.token, { vehicleId: second?.id });
  check('cannot post with a vehicle that is not approved', r.status >= 400,
    (r.data?.error ?? '').slice(0, 70));

  r = await postAdventure(other.token, { vehicleId: veh.id });
  check("cannot post with someone else's vehicle", r.status >= 400,
    (r.data?.error ?? '').slice(0, 70));

  const listed = await api('/vehicles/mine', { token: v.token });
  check('both vehicles are listed', listed.data?.vehicles?.length === 2,
    String(listed.data?.vehicles?.length));

  // ── SSN is never stored ─────────────────────────────────────────────────────
  const path = require('path');
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

  // This script deletes rows. `backend/.env` has pointed DATABASE_URL at the
  // live Supabase database, so refuse anything that is not a local copy rather
  // than trusting whoever runs it to have exported the right value.
  const dbUrl = process.env.DATABASE_URL ?? '';
  const dbHost = (() => {
    try { return new URL(dbUrl).hostname; } catch { return ''; }
  })();
  const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', 'host.docker.internal'];
  if (!LOCAL_HOSTS.includes(dbHost)) {
    console.log(`\nSKIP  database checks and cleanup — DATABASE_URL points at "${dbHost || 'an unreadable host'}", not a local database.`);
    console.log('      Export DATABASE_URL for a local copy and run this again to include them.');
    console.log(`\n${failures === 0 ? 'ALL HTTP CHECKS PASSED (database checks skipped)' : `${failures} CHECK(S) FAILED`}`);
    process.exit(failures === 0 ? 0 : 1);
  }

  const { Client } = require('pg');
  const pg = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const cols = await pg.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name IN ('mobile_users','mobile_vehicles') AND column_name ILIKE '%ssn%'`);
  const names = cols.rows.map((x) => x.column_name).sort();
  check('only ssn_last4 / ssn_verified exist — no full-SSN column',
    names.every((n) => n === 'ssn_last4' || n === 'ssn_verified'), names.join(', '));

  const bg = await api('/background-check/status', { token: v.token });
  check('background check starts not_started', bg.data?.status === 'not_started', bg.data?.status);
  check('SSN not verified yet', bg.data?.ssnVerified === false, String(bg.data?.ssnVerified));

  // Cleanup
  if (tripId) await pg.query(`DELETE FROM mobile_trips WHERE id=$1`, [tripId]);
  const all = [v.id, other.id];
  await pg.query(`DELETE FROM mobile_vehicles WHERE user_id = ANY($1)`, [all]);
  await pg.query(`DELETE FROM mobile_sessions WHERE user_id = ANY($1)`, [all]);
  await pg.query(`DELETE FROM mobile_users WHERE id = ANY($1)`, [all]);
  await pg.end();

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('ERROR:', e); process.exit(1); });
