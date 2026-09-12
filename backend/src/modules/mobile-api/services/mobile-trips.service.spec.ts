import { ForbiddenException } from '@nestjs/common';
import { FindOperator } from 'typeorm';

import { MobileTrip } from '../entities/mobile.entities';
import { MobileTripsService } from './mobile-trips.service';

const DRIVER = '11111111-1111-4111-8111-111111111111';

function tripRow(overrides: Partial<MobileTrip> = {}): MobileTrip {
  return {
    id: 'trip_1',
    driver_id: DRIVER,
    from_city: 'Austin, TX',
    to_city: 'Houston, TX',
    departure_at: new Date(Date.now() + 3_600_000),
    seats_available: 3,
    luggage_space: 2,
    price_per_seat: '32.40',
    note: '',
    car: 'Silver Toyota Camry',
    pref_smoking: false,
    pref_pets: false,
    pref_music: true,
    pref_ac: true,
    status: 'active',
    start_video_url: null,
    started_at: null,
    created_at: new Date(),
    ...overrides,
  } as MobileTrip;
}

function build() {
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const trips = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((init: Partial<MobileTrip>) => init),
    save: jest.fn((row: Partial<MobileTrip>) =>
      Promise.resolve({ ...tripRow(), ...row }),
    ),
  };
  const reads = { findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
  const users = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const bookings = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
  const groups = { findOne: jest.fn().mockResolvedValue(null) };
  const groupMembers = { findOne: jest.fn().mockResolvedValue(null) };
  const emails = { sendPreTripVideoReceivedEmail: jest.fn() };
  const vehiclesService = {
    assertReadyToDrive: jest
      .fn()
      .mockResolvedValue({ color: 'Silver', make: 'Toyota', model: 'Camry' }),
  };

  const service = new MobileTripsService(
    config as never,
    trips as never,
    reads as never,
    users as never,
    bookings as never,
    groups as never,
    groupMembers as never,
    emails as never,
    vehiclesService as never,
  );
  return { service, trips, vehiclesService };
}

/** The `where.departure_at` operator TypeORM was handed. */
function departureFilter(trips: { find: jest.Mock }): FindOperator<Date> {
  const [options] = trips.find.mock.calls[0] as [
    { where: { departure_at: FindOperator<Date> } },
  ];
  return options.where.departure_at;
}

/** The three bounds inside the day filter's `And(...)`, in order. */
function departureBounds(trips: { find: jest.Mock }) {
  const filter = departureFilter(trips);
  expect(filter.type).toBe('and');
  const [afterNow, dayStart, beforeNextMidnight] =
    filter.value as unknown as FindOperator<Date>[];
  return { afterNow, dayStart, beforeNextMidnight };
}

/**
 * Whether a departure at `candidate` satisfies every bound TypeORM was handed.
 * Asserting on operator types alone kept missing which instants actually make
 * the cut, which is the only thing a Sailor sees.
 */
function matches(trips: { find: jest.Mock }, candidate: Date): boolean {
  const filter = departureFilter(trips);
  const bounds =
    filter.type === 'and'
      ? (filter.value as unknown as FindOperator<Date>[])
      : [filter];
  const at = candidate.getTime();
  return bounds.every((bound) => {
    const value = bound.value.getTime();
    switch (bound.type) {
      case 'moreThan':
        return at > value;
      case 'moreThanOrEqual':
        return at >= value;
      case 'lessThan':
        return at < value;
      default:
        throw new Error(`unhandled bound: ${bound.type}`);
    }
  });
}

/** `YYYY-MM-DD` for a date, in the server's own timezone. */
function localDay(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

describe('MobileTripsService.list', () => {
  it('leaves out adventures whose departure has passed', async () => {
    // The reported bug: a post stays `active` after its departure time, so the
    // feed kept showing back-dated posts as live.
    const { service, trips } = build();
    const before = Date.now();

    await service.list();

    const filter = departureFilter(trips);
    expect(filter.type).toBe('moreThan');
    expect(filter.value.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('searches today from now rather than from midnight', async () => {
    const { service, trips } = build();
    const today = localDay(new Date());

    await service.list(undefined, undefined, today);

    const { afterNow, dayStart } = departureBounds(trips);
    expect(afterNow.value.getTime()).toBeGreaterThanOrEqual(
      new Date(`${today}T00:00:00`).getTime(),
    );
    expect(afterNow.value.getTime()).toBeLessThanOrEqual(Date.now());
    expect(dayStart.value).toEqual(new Date(`${today}T00:00:00`));
    // This morning's departures have left; they must not come back because a
    // date was supplied.
    expect(matches(trips, new Date(`${today}T00:00:00`))).toBe(false);
  });

  it('keeps the lower bound strictly after now, with a date and without one', async () => {
    // A departure at exactly `now` has left. Both paths must agree on that.
    const undated = build();
    await undated.service.list();
    const undatedNow = departureFilter(undated.trips).value;
    expect(matches(undated.trips, undatedNow)).toBe(false);
    expect(matches(undated.trips, new Date(undatedNow.getTime() + 1))).toBe(
      true,
    );

    const dated = build();
    await dated.service.list(undefined, undefined, localDay(new Date()));
    const datedNow = departureBounds(dated.trips).afterNow.value;
    expect(matches(dated.trips, datedNow)).toBe(false);
    expect(matches(dated.trips, new Date(datedNow.getTime() + 1))).toBe(true);
  });

  it("includes a future day's midnight departure", async () => {
    // The regression: one `MoreThan(max(dayStart, now))` lower bound made the
    // day start exclusive too, so a 00:00 departure on a day still to come was
    // dropped from its own day — and from every other day as well.
    const { service, trips } = build();

    await service.list(undefined, undefined, '2030-03-01');

    expect(matches(trips, new Date('2030-03-01T00:00:00'))).toBe(true);
    // One millisecond earlier is the last instant of February.
    expect(matches(trips, new Date('2030-02-28T23:59:59.999'))).toBe(false);
  });

  it('leaves the following midnight to the following day', async () => {
    const { service, trips } = build();

    await service.list(undefined, undefined, '2030-03-01');

    // 00:00 on the 2nd is the 2nd's first departure, not the 1st's last, so the
    // upper bound is exclusive. `Between` would have returned it for both days.
    expect(matches(trips, new Date('2030-03-01T23:59:59.999'))).toBe(true);
    expect(matches(trips, new Date('2030-03-02T00:00:00'))).toBe(false);
  });

  it('bounds a future day at exactly midnight to midnight', async () => {
    const { service, trips } = build();

    await service.list(undefined, undefined, '2030-03-01');

    const { dayStart, beforeNextMidnight } = departureBounds(trips);
    expect(dayStart.type).toBe('moreThanOrEqual');
    expect(dayStart.value).toEqual(new Date('2030-03-01T00:00:00'));
    expect(beforeNextMidnight.type).toBe('lessThan');
    expect(beforeNextMidnight.value).toEqual(new Date('2030-03-02T00:00:00'));
  });

  it('returns nothing for a day that is already over', async () => {
    const { service, trips } = build();

    await service.list(undefined, undefined, '2020-01-01');

    // An impossible window: after now, but before 2020. Nothing in that day —
    // midnight included — can satisfy it.
    expect(matches(trips, new Date('2020-01-01T00:00:00'))).toBe(false);
    expect(matches(trips, new Date('2020-01-01T12:00:00'))).toBe(false);
    const { afterNow, beforeNextMidnight } = departureBounds(trips);
    expect(afterNow.value.getTime()).toBeGreaterThan(
      beforeNextMidnight.value.getTime(),
    );
  });
});

describe('MobileTripsService — replies are off', () => {
  it('refuses to post a reply', () => {
    const { service } = build();
    expect(() => service.reply()).toThrow(ForbiddenException);
  });

  it('serves a post with no replies and a zero count', async () => {
    const { service, trips } = build();
    trips.findOne.mockResolvedValue(tripRow());

    const result = await service.getOne('trip_1', 'viewer');

    expect(result.replies).toEqual([]);
    expect(result.trip.replyCount).toBe(0);
  });
});

describe('MobileTripsService.create', () => {
  it('posts with the vehicle the Voyager chose', async () => {
    const { service, vehiclesService } = build();

    await service.create(DRIVER, {
      fromCity: 'Austin, TX',
      toCity: 'Houston, TX',
      departureAt: new Date(Date.now() + 86_400_000).toISOString(),
      seatsAvailable: 3,
      pricePerSeat: 32.4,
      vehicleId: 'vehicle_2',
    });

    expect(vehiclesService.assertReadyToDrive).toHaveBeenCalledWith(
      DRIVER,
      'vehicle_2',
    );
  });

  it('lets the server pick when no vehicle is named', async () => {
    const { service, vehiclesService } = build();

    await service.create(DRIVER, {
      fromCity: 'Austin, TX',
      toCity: 'Houston, TX',
      departureAt: new Date(Date.now() + 86_400_000).toISOString(),
      seatsAvailable: 3,
      pricePerSeat: 32.4,
    });

    expect(vehiclesService.assertReadyToDrive).toHaveBeenCalledWith(
      DRIVER,
      undefined,
    );
  });
});
