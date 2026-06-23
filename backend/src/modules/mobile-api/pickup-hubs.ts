/**
 * Minimal pickup-hub registry used to embed store metadata in trip-group
 * responses. Mirrors the Replit `services/pickup-hubs` shape. Unknown ids
 * resolve to `null` so the response remains valid.
 */
export interface PickupHubMeta {
  hubId: string;
  brand: 'walmart' | 'target';
  storeName: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

const HUBS: Record<string, PickupHubMeta> = {
  hub_austin_walmart_n: {
    hubId: 'hub_austin_walmart_n',
    brand: 'walmart',
    storeName: 'Walmart Supercenter — N Lamar',
    address: '710 E Ben White Blvd, Austin, TX 78704',
    city: 'Austin, TX',
    latitude: 30.225,
    longitude: -97.766,
  },
  hub_houston_target_heights: {
    hubId: 'hub_houston_target_heights',
    brand: 'target',
    storeName: 'Target — Sawyer Heights',
    address: '2580 Shearn St, Houston, TX 77007',
    city: 'Houston, TX',
    latitude: 29.772,
    longitude: -95.39,
  },
};

export function getHubById(id: string): PickupHubMeta | null {
  return HUBS[id] ?? null;
}
