import { apiClient } from "./api";
import type { Booking } from "./bookings";

export interface LiveLocationPoint {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  updatedAt: string;
}

export interface TrackingSnapshot {
  booking: Booking;
  driver: {
    id: string;
    name: string;
    phone: string | null;
    car: string;
    location: LiveLocationPoint | null;
  };
  rider: {
    id: string;
    location: LiveLocationPoint | null;
  };
  viewerRole: "driver" | "rider";
}

export interface PostLocationInput {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
}

export async function getBookingTracking(
  bookingId: string,
): Promise<TrackingSnapshot> {
  return apiClient.get<TrackingSnapshot>(`/bookings/${bookingId}/tracking`);
}

export async function postBookingLocation(
  bookingId: string,
  input: PostLocationInput,
): Promise<{ ok: true; updatedAt: string }> {
  return apiClient.post<{ ok: true; updatedAt: string }>(
    `/bookings/${bookingId}/location`,
    input,
  );
}

/** Great-circle distance in miles. */
export function distanceMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Digits-only phone, or null when there is nothing dialable. */
export function normalizeDialablePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.length < 10) return null;
  return digits;
}

/** Digits-only phone for tel: links. */
export function phoneToTelHref(phone: string | null | undefined): string | null {
  const digits = normalizeDialablePhone(phone);
  return digits ? `tel:${digits}` : null;
}
