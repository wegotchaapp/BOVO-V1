/** Texas MVP city centers for map routing. */

export interface Coord {
  latitude: number;
  longitude: number;
}

const CITY_COORDS: Record<string, Coord> = {
  dallas: { latitude: 32.7767, longitude: -96.797 },
  austin: { latitude: 30.2672, longitude: -97.7431 },
  houston: { latitude: 29.7604, longitude: -95.3698 },
  "san antonio": { latitude: 29.4241, longitude: -98.4936 },
  "fort worth": { latitude: 32.7555, longitude: -97.3308 },
  plano: { latitude: 33.0198, longitude: -96.6989 },
  waco: { latitude: 31.5493, longitude: -97.1467 },
  "corpus christi": { latitude: 27.8006, longitude: -97.3964 },
  lubbock: { latitude: 33.5779, longitude: -101.8552 },
  amarillo: { latitude: 35.222, longitude: -101.8313 },
  "el paso": { latitude: 31.7619, longitude: -106.485 },
  arlington: { latitude: 32.7357, longitude: -97.1081 },
};

export function getCityCoord(city: string): Coord {
  const key = city.toLowerCase().split(",")[0].trim();
  return CITY_COORDS[key] ?? CITY_COORDS.austin;
}

export function cityShort(city: string): string {
  return city.replace(/, TX$/i, "").replace(/, AR$/i, "").trim();
}

export function isMapboxTokenConfigured(token?: string | null): boolean {
  const t = (token ?? "").trim();
  if (!t) return false;
  if (t.includes("your-mapbox") || t.includes("pk.your")) return false;
  return t.startsWith("pk.");
}
