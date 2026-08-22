/**
 * Item 10: 1:1 messaging with the Voyager, and automatic group formation once
 * multiple Sailors are on the same adventure.
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
      body: { name: `Msg ${label}`, email: `msg_${label}_${stamp}@test.com`, phone: '5125550100', password: 'testpass123' },
    });
    if (!r.data?.token) throw new Error(`register ${label}: ${JSON.stringify(r.data)}`);
    return { token: r.data.token, id: r.data.user.id, name: `Msg ${label}` };
  };

  const voyager = await mk('voyager');
  const sailorA = await mk('sailorA');
  const sailorB = await mk('sailorB');
  const stranger = await mk('stranger');

  await makeVehicleRoadReady(voyager.token, `1HGCM82633A${String(stamp).slice(-6)}`);
  await approveVehicle(voyager.token);
  const trip = await api('/trips', {
    method: 'POST', token: voyager.token,
    body: {
      fromCity: 'Austin, TX', toCity: 'Houston, TX',
      departureAt: new Date(Date.now() + 86400000).toISOString(),
      seatsAvailable: 3, luggageSpace: 3, pricePerSeat: 0, note: 'messaging e2e',
    },
  });
  const tripId = trip.data?.trip?.id;
  check('adventure created', !!tripId, tripId ?? JSON.stringify(trip.data));
  if (!tripId) process.exit(1);

  // ── Before booking: no conversation should exist ────────────────────────────
  let convs = await api('/conversations/mine', { token: sailorA.token });
  const before = (convs.data?.conversations ?? []).length;
  check('Sailor has no conversations before booking', before === 0, `${before}`);

  // ── Sailor A books ──────────────────────────────────────────────────────────
  const bookA = await api('/bookings', {
    method: 'POST', token: sailorA.token,
    body: { tripId, seats: 1, paymentMethod: 'card', insuranceOptedIn: false },
  });
  const bookingA = bookA.data?.booking;
  check('Sailor A booked', !!bookingA?.id, JSON.stringify(bookA.data).slice(0, 90));
  check('booking returns a groupId', !!bookingA?.groupId, String(bookingA?.groupId));

  // ── 1:1 conversation auto-created with the Voyager ──────────────────────────
  convs = await api('/conversations/mine', { token: sailorA.token });
  const list = convs.data?.conversations ?? [];
  check('1:1 conversation auto-created on booking', list.length === 1, `${list.length}`);
  const convId = list[0]?.id;
  check('conversation names the Voyager', list[0]?.userName === voyager.name,
    list[0]?.userName);

  // ── Sailor can message the Voyager, and vice versa ──────────────────────────
  let r = await api(`/conversations/${convId}/messages`, {
    method: 'POST', token: sailorA.token, body: { text: 'Hi! Where exactly are you picking up?' },
  });
  check('Sailor can send a 1:1 message', r.status === 200 || r.status === 201,
    r.data?.error ?? String(r.status));

  r = await api(`/conversations/${convId}/messages`, {
    method: 'POST', token: voyager.token, body: { text: 'Outside the HEB on Riverside.' },
  });
  check('Voyager can reply', r.status === 200 || r.status === 201, r.data?.error ?? String(r.status));

  const thread = await api(`/conversations/${convId}`, { token: sailorA.token });
  check('thread has both messages', (thread.data?.messages ?? []).length === 2,
    `${(thread.data?.messages ?? []).length}`);

  // ── A stranger must not read someone else's thread ──────────────────────────
  r = await api(`/conversations/${convId}`, { token: stranger.token });
  check('stranger cannot read the thread', r.status >= 400, String(r.status));
  r = await api(`/conversations/${convId}/messages`, {
    method: 'POST', token: stranger.token, body: { text: 'let me in' },
  });
  check('stranger cannot post to the thread', r.status >= 400, String(r.status));

  // ── Voyager can open a 1:1 with a booked Sailor directly ────────────────────
  r = await api('/conversations', {
    method: 'POST', token: voyager.token, body: { otherUserId: sailorA.id },
  });
  check('Voyager can open a 1:1 with a Sailor', r.status === 200 || r.status === 201,
    r.data?.error ?? String(r.status));
  check('opening reuses the same conversation', r.data?.conversation?.id === convId,
    `${r.data?.conversation?.id}`);

  // ── Group: one Sailor ───────────────────────────────────────────────────────
  let groups = await api('/groups/mine', { token: sailorA.token });
  let g = (groups.data?.groups ?? [])[0];
  check('Sailor A is in the adventure group', !!g?.id, JSON.stringify(groups.data).slice(0, 80));
  check('group has 2 members (Voyager + Sailor A)', g?.memberCount === 2, `${g?.memberCount}`);

  // ── Sailor B books → group grows automatically ──────────────────────────────
  const bookB = await api('/bookings', {
    method: 'POST', token: sailorB.token,
    body: { tripId, seats: 1, paymentMethod: 'card', insuranceOptedIn: false },
  });
  check('Sailor B booked', !!bookB.data?.booking?.id, JSON.stringify(bookB.data).slice(0, 90));
  check('Sailor B joins the SAME group', bookB.data?.booking?.groupId === g?.id,
    `${bookB.data?.booking?.groupId} vs ${g?.id}`);

  groups = await api('/groups/mine', { token: sailorA.token });
  g = (groups.data?.groups ?? [])[0];
  check('group now has 3 members', g?.memberCount === 3, `${g?.memberCount}`);

  const detail = await api(`/groups/${g.id}`, { token: sailorB.token });
  const msgs = detail.data?.messages ?? [];
  check('Sailor B can read the group', detail.status === 200, String(detail.status));
  check('a system message announced the new Sailor',
    msgs.some((m) => m.isSystem && /joined/i.test(m.text || '')),
    msgs.filter((m) => m.isSystem).map((m) => m.text).join(' | ').slice(0, 100));

  r = await api(`/groups/${g.id}/messages`, {
    method: 'POST', token: sailorB.token, body: { text: 'Can we meet 10 minutes earlier?' },
  });
  check('Sailor B can post to the group', r.status === 200 || r.status === 201,
    r.data?.error ?? String(r.status));

  // ── A non-member must not read the group ────────────────────────────────────
  r = await api(`/groups/${g.id}`, { token: stranger.token });
  check('non-member cannot read the group', r.status >= 400, String(r.status));

  // Cleanup
  const path = require('path');
  process.chdir('/Users/vaishnavi/Desktop/TheBovogo App/backend');
  require('dotenv').config({ path: path.join(process.cwd(), '.env') });
  const { Client } = require('pg');
  const pg = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const all = [voyager.id, sailorA.id, sailorB.id, stranger.id];
  await pg.query(`DELETE FROM mobile_trip_group_messages WHERE group_id IN (SELECT id FROM mobile_trip_groups WHERE trip_id=$1)`, [tripId]);
  await pg.query(`DELETE FROM mobile_trip_group_members WHERE group_id IN (SELECT id FROM mobile_trip_groups WHERE trip_id=$1)`, [tripId]);
  await pg.query(`DELETE FROM mobile_trip_groups WHERE trip_id=$1`, [tripId]);
  await pg.query(`DELETE FROM mobile_direct_messages WHERE sender_id = ANY($1)`, [all]);
  await pg.query(`DELETE FROM mobile_conversations WHERE user_low_id = ANY($1) OR user_high_id = ANY($1)`, [all]);
  await pg.query(`DELETE FROM mobile_bookings WHERE trip_id=$1`, [tripId]);
  await pg.query(`DELETE FROM mobile_trips WHERE id=$1`, [tripId]);
  await pg.query(`DELETE FROM mobile_vehicles WHERE user_id = ANY($1)`, [all]);
  await pg.query(`DELETE FROM mobile_sessions WHERE user_id = ANY($1)`, [all]);
  await pg.query(`DELETE FROM mobile_users WHERE id = ANY($1)`, [all]);
  await pg.end();

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('ERROR:', e); process.exit(1); });
