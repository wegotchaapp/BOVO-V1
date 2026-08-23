/**
 * Route geometry for deviation detection.
 *
 * Pure functions, no I/O — the distance question is "how far is this point from
 * the route we stored", which needs no network call at all. The previous
 * implementation asked Mapbox "how far is this point from the nearest road",
 * which is a different question with a misleading answer: a driver 200 miles
 * off-route but on a highway measures zero.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_MILES = 3959;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Decodes a Google/Mapbox encoded polyline.
 *
 * `precision` is 5 for Mapbox's default `geometries=polyline` and 6 for
 * `polyline6`. Passing the wrong one silently yields coordinates off by a
 * factor of ten, so callers should be explicit.
 */
export function decodePolyline(encoded: string, precision = 5): LatLng[] {
  const factor = Math.pow(10, precision);
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / factor, longitude: lng / factor });
  }

  return points;
}

/** Great-circle distance in miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Shortest distance in miles from a point to the segment ab.
 *
 * Projects into a local equirectangular plane first. Over a segment of a driving
 * route the error from treating that patch of earth as flat is far below the
 * miles-wide threshold this feeds, and it avoids the cost and edge cases of
 * doing it on the sphere.
 */
function distanceToSegmentMiles(p: LatLng, a: LatLng, b: LatLng): number {
  const latRef = toRad((a.latitude + b.latitude) / 2);
  const x = (q: LatLng) => toRad(q.longitude) * Math.cos(latRef) * EARTH_RADIUS_MILES;
  const y = (q: LatLng) => toRad(q.latitude) * EARTH_RADIUS_MILES;

  const px = x(p), py = y(p);
  const ax = x(a), ay = y(a);
  const bx = x(b), by = y(b);

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  // Degenerate segment (duplicate points appear in real polylines).
  if (lenSq === 0) return haversineMiles(p, a);

  // Clamped so the nearest point never falls beyond the segment's ends.
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Shortest distance in miles from a point to a route.
 *
 * Returns `null` for an empty route rather than a number, so "we could not tell"
 * is never mistaken for "zero miles off course".
 */
export function distanceFromRouteMiles(point: LatLng, route: LatLng[]): number | null {
  if (route.length === 0) return null;
  if (route.length === 1) return haversineMiles(point, route[0]);

  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const d = distanceToSegmentMiles(point, route[i], route[i + 1]);
    if (d < best) best = d;
    // Nothing later can beat being on the line.
    if (best === 0) break;
  }
  return best;
}

/**
 * Encodes coordinates into a Google/Mapbox polyline.
 *
 * The inverse of `decodePolyline`, used to build realistic route fixtures for
 * tests and to round-trip the decoder against itself.
 */
export function encodePolyline(points: LatLng[], precision = 5): string {
  const factor = Math.pow(10, precision);
  let out = '';
  let prevLat = 0;
  let prevLng = 0;

  const chunk = (value: number): string => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let piece = '';
    while (v >= 0x20) {
      piece += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    piece += String.fromCharCode(v + 63);
    return piece;
  };

  for (const p of points) {
    const lat = Math.round(p.latitude * factor);
    const lng = Math.round(p.longitude * factor);
    out += chunk(lat - prevLat) + chunk(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}
