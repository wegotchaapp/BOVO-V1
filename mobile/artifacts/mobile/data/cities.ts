/**
 * MVP city scope for Bovogo.
 *
 * For launch the only bookable corridor is Austin ↔ Houston. Other cities
 * are shown to the user as "Coming soon" so they understand the network's
 * shape, but cannot be selected for booking or posting trips.
 *
 * Keep the labels stable — the server validates incoming from/to values
 * against MVP_CITIES exactly.
 */

export const MVP_CITIES = ["Austin, TX", "Houston, TX"] as const;

export const COMING_SOON_CITIES = ["Dallas, TX", "Bentonville, AR"] as const;

export type MvpCity = (typeof MVP_CITIES)[number];

export type CityStatus = "mvp" | "coming-soon";

export interface CityOption {
  label: string;
  status: CityStatus;
}

/** All cities the user sees in pickers — MVP first, then coming-soon. */
export const ALL_CITY_OPTIONS: CityOption[] = [
  ...MVP_CITIES.map((c) => ({ label: c, status: "mvp" as const })),
  ...COMING_SOON_CITIES.map((c) => ({ label: c, status: "coming-soon" as const })),
];

export function isMvpCity(city: string): city is MvpCity {
  return (MVP_CITIES as readonly string[]).includes(city);
}

export function getCityStatus(city: string): CityStatus | "unknown" {
  if (isMvpCity(city)) return "mvp";
  if ((COMING_SOON_CITIES as readonly string[]).includes(city)) return "coming-soon";
  return "unknown";
}
