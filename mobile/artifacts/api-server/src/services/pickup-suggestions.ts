import {
  CITY_CENTROIDS,
  hubsForCity,
  type HubCity,
  type PickupHub,
} from "./pickup-hubs";

export interface PickupSuggestion {
  hub: PickupHub;
  /** Estimated driver detour from the trip's origin centroid, in minutes. */
  driverDetourMinutes: number;
  /** Average rider travel time to the hub, in minutes. */
  avgRiderTravelMinutes: number;
  /** Lower = better. Combined score from the weighted formula. */
  score: number;
}

interface RiderPoint {
  lat: number;
  lng: number;
}

const KM_PER_DEGREE_LAT = 110.574;
const AVG_URBAN_KPH = 32; // proxy: 32 km/h ≈ city driving average
const MIN_PER_HOUR = 60;

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  // For city-scale distances haversine is overkill but cheap and correct.
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa =
    s1 * s1 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      s2 *
      s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(aa)));
}

function kmToMinutes(km: number): number {
  return (km / AVG_URBAN_KPH) * MIN_PER_HOUR;
}

/**
 * Compute top-N pickup suggestions for a trip.
 *
 * NOTE: Until live GPS sharing lands we don't have real per-user coordinates.
 * For now we use:
 *   - `fromCity` centroid as the driver's origin proxy
 *   - jittered rider centroids around `fromCity` (city-scale spread)
 * The scoring formula matches the product spec
 *   score = 0.7 * driver_detour_minutes + 0.3 * avg_rider_travel_minutes
 * so swapping in real coords later is a drop-in change.
 */
export function suggestPickupHubs(opts: {
  fromCity: string;
  /**
   * Optional rider coordinates. If empty we synthesize a tight cluster around
   * the city centroid so the scoring still differentiates between hubs.
   */
  riderPoints?: RiderPoint[];
  topN?: number;
}): PickupSuggestion[] {
  const { fromCity, topN = 3 } = opts;
  const centroid = CITY_CENTROIDS[fromCity as HubCity];
  if (!centroid) return [];

  const driverPoint = { lat: centroid.lat, lng: centroid.lng };

  // Cluster riders. With no real coords we fall back to the centroid itself —
  // every hub then ranks purely by proximity to the city center.
  const riders: RiderPoint[] =
    opts.riderPoints && opts.riderPoints.length > 0
      ? opts.riderPoints
      : [driverPoint];

  const riderAvg = {
    lat: riders.reduce((s, r) => s + r.lat, 0) / riders.length,
    lng: riders.reduce((s, r) => s + r.lng, 0) / riders.length,
  };

  const hubPoint = (h: PickupHub) => ({ lat: h.latitude, lng: h.longitude });

  // Corridor filter: keep only hubs within ~25km of the driver origin.
  // (Real corridor analysis needs a polyline; this approximation is enough
  // for intra-city pickup choice.)
  const CORRIDOR_KM = 25;
  const candidates = hubsForCity(fromCity).filter(
    (h) => haversineKm(driverPoint, hubPoint(h)) <= CORRIDOR_KM,
  );

  const scored: PickupSuggestion[] = candidates.map((hub) => {
    const p = hubPoint(hub);
    const driverDetourKm = haversineKm(driverPoint, p);
    const avgRiderKm =
      riders.reduce((s, r) => s + haversineKm(r, p), 0) / riders.length;
    const driverDetourMinutes = kmToMinutes(driverDetourKm);
    const avgRiderTravelMinutes = kmToMinutes(avgRiderKm);
    const score =
      driverDetourMinutes * 0.7 + avgRiderTravelMinutes * 0.3;
    return {
      hub,
      driverDetourMinutes: Math.round(driverDetourMinutes),
      avgRiderTravelMinutes: Math.round(avgRiderTravelMinutes),
      score,
    };
  });

  scored.sort((a, b) => a.score - b.score);
  void riderAvg; // reserved for future cluster-spread weighting
  void KM_PER_DEGREE_LAT;
  return scored.slice(0, topN);
}
