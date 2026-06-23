/**
 * Hand-curated Walmart and Target pickup hubs for the MVP Austin ↔ Houston
 * corridor. Coordinates are geocoded from the listed street addresses.
 *
 * Adding a new hub requires nothing more than appending to this list — there
 * is no DB row, no migration, and the suggestion engine will pick it up on
 * next call.
 */

export type HubBrand = "walmart" | "target";
export type HubCity = "Austin, TX" | "Houston, TX";

export interface PickupHub {
  id: string;
  brand: HubBrand;
  storeName: string;
  address: string;
  city: HubCity;
  latitude: number;
  longitude: number;
}

export const PICKUP_HUBS: ReadonlyArray<PickupHub> = [
  // ── Austin Walmart ──────────────────────────────────────────────────────────
  {
    id: "wm_atx_benwhite",
    brand: "walmart",
    storeName: "Walmart Supercenter",
    address: "710 E Ben White Blvd, Austin, TX 78704",
    city: "Austin, TX",
    latitude: 30.2227,
    longitude: -97.7574,
  },
  {
    id: "wm_atx_norwood",
    brand: "walmart",
    storeName: "Walmart Supercenter",
    address: "1030 Norwood Park Blvd, Austin, TX 78753",
    city: "Austin, TX",
    latitude: 30.3722,
    longitude: -97.6995,
  },
  {
    id: "wm_atx_rr620",
    brand: "walmart",
    storeName: "Walmart Supercenter",
    address: "13201 Ranch Rd 620 N, Austin, TX 78717",
    city: "Austin, TX",
    latitude: 30.4757,
    longitude: -97.7866,
  },
  {
    id: "wm_atx_fm620",
    brand: "walmart",
    storeName: "Walmart Supercenter",
    address: "8201 N FM 620, Austin, TX 78726",
    city: "Austin, TX",
    latitude: 30.4253,
    longitude: -97.8275,
  },

  // ── Austin Target ───────────────────────────────────────────────────────────
  {
    id: "tg_atx_mueller",
    brand: "target",
    storeName: "Target — Mueller",
    address: "1801 E 51st St, Austin, TX 78723",
    city: "Austin, TX",
    latitude: 30.3034,
    longitude: -97.7045,
  },
  {
    id: "tg_atx_benwhite",
    brand: "target",
    storeName: "Target — South Austin",
    address: "2300 W Ben White Blvd, Austin, TX 78704",
    city: "Austin, TX",
    latitude: 30.2358,
    longitude: -97.7821,
  },
  {
    id: "tg_atx_research",
    brand: "target",
    storeName: "Target — North Austin",
    address: "8601 Research Blvd, Austin, TX 78758",
    city: "Austin, TX",
    latitude: 30.3614,
    longitude: -97.7212,
  },
  {
    id: "tg_atx_mopac",
    brand: "target",
    storeName: "Target — Sunset Valley",
    address: "5400 Brodie Ln, Sunset Valley, TX 78745",
    city: "Austin, TX",
    latitude: 30.2299,
    longitude: -97.8417,
  },

  // ── Houston Walmart ─────────────────────────────────────────────────────────
  {
    id: "wm_hou_silber",
    brand: "walmart",
    storeName: "Walmart Supercenter",
    address: "1118 Silber Rd, Houston, TX 77055",
    city: "Houston, TX",
    latitude: 29.7853,
    longitude: -95.4842,
  },
  {
    id: "wm_hou_postoak",
    brand: "walmart",
    storeName: "Walmart Supercenter",
    address: "9555 S Post Oak Rd, Houston, TX 77035",
    city: "Houston, TX",
    latitude: 29.6473,
    longitude: -95.4632,
  },
  {
    id: "wm_hou_samhouston",
    brand: "walmart",
    storeName: "Walmart Supercenter",
    address: "5655 E Sam Houston Pkwy N, Houston, TX 77015",
    city: "Houston, TX",
    latitude: 29.7825,
    longitude: -95.1733,
  },
  {
    id: "wm_hou_westview",
    brand: "walmart",
    storeName: "Walmart Supercenter",
    address: "10750 Westview Dr, Houston, TX 77043",
    city: "Houston, TX",
    latitude: 29.7944,
    longitude: -95.5598,
  },

  // ── Houston Target ──────────────────────────────────────────────────────────
  {
    id: "tg_hou_sanfelipe",
    brand: "target",
    storeName: "Target — River Oaks",
    address: "4323 San Felipe St, Houston, TX 77027",
    city: "Houston, TX",
    latitude: 29.7484,
    longitude: -95.4496,
  },
  {
    id: "tg_hou_mainst",
    brand: "target",
    storeName: "Target — South Main",
    address: "8500 S Main St, Houston, TX 77025",
    city: "Houston, TX",
    latitude: 29.6857,
    longitude: -95.4244,
  },
  {
    id: "tg_hou_meyerland",
    brand: "target",
    storeName: "Target — Meyerland",
    address: "250 Meyerland Plaza Mall, Houston, TX 77096",
    city: "Houston, TX",
    latitude: 29.6739,
    longitude: -95.4711,
  },
  {
    id: "tg_hou_sawyer",
    brand: "target",
    storeName: "Target — Sawyer Heights",
    address: "1118 Sawyer St, Houston, TX 77007",
    city: "Houston, TX",
    latitude: 29.7635,
    longitude: -95.3848,
  },
];

/** City centroids used as a coordinate proxy when no live GPS is available. */
export const CITY_CENTROIDS: Record<HubCity, { lat: number; lng: number }> = {
  "Austin, TX": { lat: 30.2672, lng: -97.7431 },
  "Houston, TX": { lat: 29.7604, lng: -95.3698 },
};

export function hubsForCity(city: string): PickupHub[] {
  return PICKUP_HUBS.filter((h) => h.city === city);
}

export function getHubById(id: string): PickupHub | undefined {
  return PICKUP_HUBS.find((h) => h.id === id);
}
