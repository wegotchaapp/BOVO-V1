/**
 * Canonical Trip / Reply types — mirror the `/api/trips` response shape.
 *
 * A "trip" in the Bovogo codebase is the unit of driver-posted supply that
 * shows up both in the rider home feed (as a social-style post with replies)
 * AND in search results (as a bookable ride). The same record serves both
 * surfaces; the UI just emphasises different fields.
 *
 * No mock arrays are exported — screens fetch via `@/lib/trips`.
 */

export interface Driver {
  id: string;
  name: string;
  rating: number;
  trips: number;
  isTopDriver: boolean;
}

export interface TripPreferences {
  smoking: boolean;
  pets: boolean;
  music: boolean;
  ac: boolean;
}

export interface Trip {
  id: string;
  driver: Driver;
  fromCity: string;
  toCity: string;
  /** ISO-8601 timestamp. */
  departureAt: string;
  seatsAvailable: number;
  luggageSpace: number;
  pricePerSeat: number;
  note: string;
  car: string;
  preferences: TripPreferences;
  status: "active" | "cancelled" | "completed";
  replyCount: number;
  createdAt: string;
}

export interface TripReply {
  id: string;
  userId: string;
  userName: string;
  text: string;
  isDriverReply: boolean;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

// ─── Display helpers ─────────────────────────────────────────────────────────

export function formatTripDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTripTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Austin↔Houston is ~3h drive — approximate arrival for the trip detail screen. */
export function approximateArrivalTime(departureIso: string): string {
  const d = new Date(new Date(departureIso).getTime() + 3 * 60 * 60 * 1000);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
