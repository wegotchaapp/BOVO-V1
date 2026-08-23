import {
  decodePolyline,
  encodePolyline,
  distanceFromRouteMiles,
  haversineMiles,
  type LatLng,
} from './route-geometry';

const DALLAS: LatLng = { latitude: 32.7767, longitude: -96.797 };
const AUSTIN: LatLng = { latitude: 30.2672, longitude: -97.7431 };

describe('decodePolyline', () => {
  it('decodes the reference polyline from the algorithm spec', () => {
    // Google's own documented example for `_p~iF~ps|U_ulLnnqC_mqNvxq`@`.
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });

  it('honours precision 6', () => {
    const [p] = decodePolyline('_izlhA~rlgdF', 6);
    expect(p.latitude).toBeCloseTo(38.5, 4);
    expect(p.longitude).toBeCloseTo(-120.2, 4);
  });

  it('returns nothing for an empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('encodePolyline', () => {
  it('round-trips through the decoder', () => {
    const route: LatLng[] = [
      { latitude: 32.7767, longitude: -96.797 },
      { latitude: 31.5493, longitude: -97.1467 },
      { latitude: 30.2672, longitude: -97.7431 },
    ];
    const back = decodePolyline(encodePolyline(route));
    expect(back).toHaveLength(3);
    back.forEach((p, i) => {
      expect(p.latitude).toBeCloseTo(route[i].latitude, 5);
      expect(p.longitude).toBeCloseTo(route[i].longitude, 5);
    });
  });

  it('reproduces the reference encoding from the spec', () => {
    expect(
      encodePolyline([
        { latitude: 38.5, longitude: -120.2 },
        { latitude: 40.7, longitude: -120.95 },
        { latitude: 43.252, longitude: -126.453 },
      ]),
    ).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });
});

describe('haversineMiles', () => {
  it('measures Dallas to Austin at the distance the app already claims', () => {
    // lib/pricing.ts's DISTANCE_TABLE says 195 driving miles; straight-line is
    // shorter, so this checks the order of magnitude rather than the exact road.
    const d = haversineMiles(DALLAS, AUSTIN);
    expect(d).toBeGreaterThan(170);
    expect(d).toBeLessThan(200);
  });

  it('is zero for a point against itself', () => {
    expect(haversineMiles(DALLAS, DALLAS)).toBeCloseTo(0, 6);
  });
});

describe('distanceFromRouteMiles', () => {
  const route: LatLng[] = [
    { latitude: 32.0, longitude: -97.0 },
    { latitude: 31.0, longitude: -97.0 },
    { latitude: 30.0, longitude: -97.0 },
  ];

  it('is ~zero for a point sitting on the line', () => {
    expect(distanceFromRouteMiles({ latitude: 31.5, longitude: -97.0 }, route)!).toBeLessThan(0.01);
  });

  it('measures perpendicular offset, not distance to the nearest vertex', () => {
    // Level with the middle vertex but a degree of longitude to the east. The
    // old snap-to-road approach could not have produced this number at all.
    const d = distanceFromRouteMiles({ latitude: 31.5, longitude: -96.0 }, route)!;
    expect(d).toBeGreaterThan(55);
    expect(d).toBeLessThan(65);
  });

  it('clamps beyond the ends rather than extrapolating the line', () => {
    // Well north of the first vertex: the answer is the distance to that
    // vertex, not to an imaginary continuation of the route.
    const beyond = { latitude: 33.0, longitude: -97.0 };
    const d = distanceFromRouteMiles(beyond, route)!;
    expect(d).toBeCloseTo(haversineMiles(beyond, route[0]), 1);
  });

  it('returns null for an empty route so it cannot read as "on course"', () => {
    expect(distanceFromRouteMiles(DALLAS, [])).toBeNull();
  });

  it('handles a single-point route', () => {
    expect(distanceFromRouteMiles(DALLAS, [AUSTIN])!).toBeCloseTo(haversineMiles(DALLAS, AUSTIN), 6);
  });

  it('tolerates duplicate consecutive points, which real polylines contain', () => {
    const dupes = [route[0], route[0], route[1], route[1], route[2]];
    expect(distanceFromRouteMiles({ latitude: 31.5, longitude: -97.0 }, dupes)!).toBeLessThan(0.01);
  });
});
