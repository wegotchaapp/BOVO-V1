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
