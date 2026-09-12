import type { Trip } from "@/data/trips";

/**
 * How long past its departure time a started adventure still counts as
 * underway. Austin ↔ Houston is about three hours on the road; a ride still
 * "in progress" long after that is one nobody closed, not one still driving.
 */
export const IN_PROGRESS_GRACE_MS = 12 * 60 * 60 * 1000;

/**
 * Whether a posted adventure is live: still departing in the future, or started
 * and plausibly still on the road. Cancelled and completed posts are not, and
 * neither is one whose departure passed without it ever starting.
 */
export function isActivePost(
  trip: Pick<Trip, "status" | "departureAt">,
  now: number = Date.now(),
): boolean {
  const departure = new Date(trip.departureAt).getTime();
  if (Number.isNaN(departure)) return false;
  if (trip.status === "active") return departure > now;
  if (trip.status === "in_progress") return departure > now - IN_PROGRESS_GRACE_MS;
  return false;
}
