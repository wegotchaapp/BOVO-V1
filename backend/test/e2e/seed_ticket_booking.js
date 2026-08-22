/**
 * Seeds one real Dallas → Austin booking and prints the Sailor's token and booking id,
 * so the booking-confirmed ticket printer can be viewed against live data.
 *
 * Not an assertion suite — a fixture maker. Rows use the `tkt_` email prefix so the
 * standard cleanup sweep removes them.
 *
 *   node test/e2e/seed_ticket_booking.js
 */
const BASE = 'http://localhost:3000/api';

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
  // VINs are unique per vehicle, so a re-run with a fixed VIN silently fails here and
  // only surfaces two steps later as "Add your vehicle before posting an adventure".
  const created = await api('/vehicles', { method: 'POST', token, body: {
    make: 'Toyota', model: 'Camry', year: 2022, color: 'Silver',
    licensePlate: `BVG-${vin.slice(-4)}`, state: 'TX', seatCount: 3, doorCount: 4, vin,
  }});
  if (created.status >= 300) {
    throw new Error(`vehicle: ${JSON.stringify(created.data)}`);
  }
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
  const mk = async (label, name) => {
    const r = await api('/auth/register', {
      method: 'POST',
      body: {
        name,
        email: `tkt_${label}_${stamp}@test.com`,
        phone: '5125550100',
        password: 'testpass123',
      },
    });
    if (!r.data?.token) throw new Error(`register ${label}: ${JSON.stringify(r.data)}`);
    return { token: r.data.token, id: r.data.user.id };
  };

  const voyager = await mk('v', 'Marcus Ellery');
  // 17-char VIN, unique per run.
  await makeVehicleRoadReady(voyager.token, `4T1BF1FK5CU${String(stamp).slice(-6)}`);
  await approveVehicle(voyager.token);

  // 08:30 departure tomorrow, so the ticket prints a realistic DATE / DEPARTS pair.
  const dep = new Date(Date.now() + 86400000);
  dep.setHours(8, 30, 0, 0);

  const trip = await api('/trips', {
    method: 'POST', token: voyager.token,
    body: {
      fromCity: 'Dallas, TX', toCity: 'Austin, TX',
      departureAt: dep.toISOString(),
      seatsAvailable: 3, luggageSpace: 2, pricePerSeat: 0,
      note: 'Leaving from Deep Ellum, straight down I-35.',
    },
  });
  const tripId = trip.data?.trip?.id;
  if (!tripId) throw new Error(`trip: ${JSON.stringify(trip.data)}`);

  const sailor = await mk('s', 'Test Sailor');
  const booked = await api('/bookings', {
    method: 'POST', token: sailor.token,
    body: { tripId, seats: 1, paymentMethod: 'card', insuranceOptedIn: true },
  });
  const b = booked.data?.booking;
  if (!b) throw new Error(`booking: ${JSON.stringify(booked.data)}`);

  // A second Sailor, so Voyager-side screens have a manifest worth looking at.
  const sailor2 = await mk('s2', 'Dana Whitlock');
  const booked2 = await api('/bookings', {
    method: 'POST', token: sailor2.token,
    body: { tripId, seats: 2, paymentMethod: 'card', insuranceOptedIn: false },
  });

  console.log(JSON.stringify({
    tripId,
    bookingId: b.id,
    status: b.status,
    seats: b.seats,
    pricePerSeat: b.pricePerSeat,
    insurancePremium: b.insurancePremium,
    serviceFee: b.serviceFee,
    totalAmount: b.totalAmount,
    groupId: b.groupId ?? null,
    departureAt: dep.toISOString(),
    secondBooking: booked2.data?.booking?.id ?? booked2.data,
    voyagerToken: voyager.token,
    sailorToken: sailor.token,
    urls: {
      bookingConfirmed: `http://localhost:8081/booking-confirmed?id=${b.id}`,
      manifest: `http://localhost:8081/manifest/${tripId}`,
      odometer: `http://localhost:8081/odometer/${tripId}`,
    },
  }, null, 2));
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
