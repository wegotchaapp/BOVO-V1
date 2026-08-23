import type { LatLng } from './route-geometry';

/**
 * City-centre coordinates for the twelve cities the app offers.
 *
 * The list mirrors `DISTANCE_TABLE` in the mobile app's `lib/pricing.ts`; a city
 * that can be picked but not located here would silently lose its route, so the
 * two must stay in step. `trips.service.ts` has its own two-city
 * `METRO_COORDINATES` predating this.
 */
const TEXAS_CITIES: Record<string, LatLng> = {
  amarillo: { latitude: 35.222, longitude: -101.8313 },
  arlington: { latitude: 32.7357, longitude: -97.1081 },
  austin: { latitude: 30.2672, longitude: -97.7431 },
  'corpus christi': { latitude: 27.8006, longitude: -97.3964 },
  dallas: { latitude: 32.7767, longitude: -96.797 },
  'el paso': { latitude: 31.7619, longitude: -106.485 },
  'fort worth': { latitude: 32.7555, longitude: -97.3308 },
  houston: { latitude: 29.7604, longitude: -95.3698 },
  lubbock: { latitude: 33.5779, longitude: -101.8552 },
  plano: { latitude: 33.0198, longitude: -96.6989 },
  'san antonio': { latitude: 29.4241, longitude: -98.4936 },
  waco: { latitude: 31.5493, longitude: -97.1467 },
};

/**
 * Looks up a city by the name the app stores, which may or may not carry the
 * ", TX" suffix and may differ in case.
 */
export function cityCoordinates(city: string | null | undefined): LatLng | null {
  if (!city) return null;
  const key = city.replace(/,\s*[A-Z]{2}\s*$/i, '').trim().toLowerCase();
  return TEXAS_CITIES[key] ?? null;
}

export const SUPPORTED_CITIES = Object.keys(TEXAS_CITIES);
