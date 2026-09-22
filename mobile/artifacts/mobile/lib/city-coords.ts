/**
 * City-centre coordinates for map routing.
 *
 * Mirrors the server's `common/geo/texas-cities.ts` — the two must stay in
 * step, because a city that can be picked here but not located there loses its
 * measured distance, and an adventure with no measured distance is not
 * bookable.
 *
 * Keyed on `"name, ST"`. The state is part of the key on purpose: resolving
 * "Bentonville, TX" to the Arkansas coordinates would point a map, and a price,
 * at the wrong place entirely.
 */

export interface Coord {
  latitude: number;
  longitude: number;
}

const CITY_COORDS: Record<string, Coord> = {
  // Texas
  "austin, tx": { latitude: 30.2672, longitude: -97.7431 },
  "houston, tx": { latitude: 29.7604, longitude: -95.3698 },
  "dallas, tx": { latitude: 32.7767, longitude: -96.797 },
  "fort worth, tx": { latitude: 32.7555, longitude: -97.3308 },
  "san antonio, tx": { latitude: 29.4241, longitude: -98.4936 },
  "plano, tx": { latitude: 33.0198, longitude: -96.6989 },
  "arlington, tx": { latitude: 32.7357, longitude: -97.1081 },
  "waco, tx": { latitude: 31.5493, longitude: -97.1467 },
  "corpus christi, tx": { latitude: 27.8006, longitude: -97.3964 },
  "lubbock, tx": { latitude: 33.5779, longitude: -101.8552 },
  "amarillo, tx": { latitude: 35.222, longitude: -101.8313 },
  "el paso, tx": { latitude: 31.7619, longitude: -106.485 },

  // Northwest Arkansas
  "bentonville, ar": { latitude: 36.3729, longitude: -94.2088 },
  "rogers, ar": { latitude: 36.332, longitude: -94.1185 },
  "springdale, ar": { latitude: 36.1867, longitude: -94.1288 },
  "fayetteville, ar": { latitude: 36.0626, longitude: -94.1574 },

  // Regional connectors
  "fort smith, ar": { latitude: 35.3859, longitude: -94.3985 },
  "little rock, ar": { latitude: 34.7465, longitude: -92.2896 },
  "tulsa, ok": { latitude: 36.154, longitude: -95.9928 },
  "oklahoma city, ok": { latitude: 35.4676, longitude: -97.5164 },
};

/** Bare names that resolve to exactly one served city, built not hand-listed. */
const UNAMBIGUOUS_BARE_NAMES: Record<string, string> = (() => {
  const seen = new Map<string, string[]>();
  for (const key of Object.keys(CITY_COORDS)) {
    const bare = key.slice(0, key.lastIndexOf(","));
    seen.set(bare, [...(seen.get(bare) ?? []), key]);
  }
  const out: Record<string, string> = {};
  for (const [bare, keys] of seen) if (keys.length === 1) out[bare] = keys[0];
  return out;
})();

/**
 * Coordinates for a city label, or **null** when it is not one we serve.
 *
 * Null rather than a default. This used to fall back to Austin, which meant an
 * unrecognised city silently drew a map of central Texas and measured its
 * distance from there — a wrong answer presented as a right one.
 */
export function getCityCoord(city: string | null | undefined): Coord | null {
  if (!city) return null;
  const key = city.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;

  const direct = CITY_COORDS[key];
  if (direct) return direct;

  // A supplied-but-wrong state has already failed and must not fall through to
  // the bare-name map.
  if (/,\s*[a-z]{2}$/.test(key)) return null;

  const resolved = UNAMBIGUOUS_BARE_NAMES[key];
  return resolved ? CITY_COORDS[resolved] : null;
}

/** Whether a route between two cities can be drawn and measured at all. */
export function isRoutableCity(city: string | null | undefined): boolean {
  return getCityCoord(city) !== null;
}

/** "Bentonville, AR" → "Bentonville". */
export function cityShort(city: string): string {
  return city.replace(/,\s*[A-Z]{2}$/i, "").trim();
}

export function isMapboxTokenConfigured(token?: string | null): boolean {
  const t = (token ?? "").trim();
  if (!t) return false;
  if (t.includes("your-mapbox") || t.includes("pk.your")) return false;
  return t.startsWith("pk.");
}
