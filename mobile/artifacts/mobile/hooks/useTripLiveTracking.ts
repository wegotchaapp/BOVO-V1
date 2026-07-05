/**
 * Publishes this device's GPS and polls the other party's live position.
 * Driver and rider both open Live Tracking; each posts their own location.
 */
import { useEffect, useRef, useState } from "react";

import { useLiveLocation } from "@/hooks/useLiveLocation";
import {
  bearingDegrees,
  distanceMiles,
  getBookingTracking,
  postBookingLocation,
  type TrackingSnapshot,
} from "@/lib/tracking";

const POLL_MS = 4000;
const POST_MS = 3000;
const AVG_SPEED_MPH = 55;

export interface TripLiveCoord {
  latitude: number;
  longitude: number;
  heading: number;
  speed?: number;
}

export interface UseTripLiveTrackingResult {
  snapshot: TrackingSnapshot | null;
  loading: boolean;
  error: string | null;
  myCoord: TripLiveCoord | null;
  driverCoord: TripLiveCoord | null;
  riderCoord: TripLiveCoord | null;
  progress: number;
  etaMinutes: number;
  etaSource: "live" | "estimate";
  driverGpsLive: boolean;
  myGpsActive: boolean;
  locationError: string | null;
  hasPermission: boolean | null;
}

export function useTripLiveTracking(
  bookingId: string | undefined,
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  routeDurationSeconds?: number,
): UseTripLiveTrackingResult {
  const [snapshot, setSnapshot] = useState<TrackingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    coord: myLive,
    hasPermission,
    error: locationError,
    isTracking: myGpsActive,
  } = useLiveLocation(Boolean(bookingId));

  const lastPosted = useRef<string>("");

  // Poll server for peer locations.
  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;

    async function pull() {
      try {
        const data = await getBookingTracking(bookingId!);
        if (!cancelled) {
          setSnapshot(data);
          setError(null);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Couldn't load live tracking");
          setLoading(false);
        }
      }
    }

    pull();
    const timer = setInterval(pull, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [bookingId]);

  // Publish this device's GPS.
  useEffect(() => {
    if (!bookingId || !myLive) return;

    const key = `${myLive.latitude.toFixed(5)},${myLive.longitude.toFixed(5)}`;
    if (key === lastPosted.current) return;

    let cancelled = false;
    const publish = async () => {
      try {
        await postBookingLocation(bookingId, {
          latitude: myLive.latitude,
          longitude: myLive.longitude,
          heading: myLive.heading,
          speed: myLive.speed,
        });
        if (!cancelled) lastPosted.current = key;
      } catch {
        // Keep trying on next tick.
      }
    };

    publish();
    const timer = setInterval(publish, POST_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [bookingId, myLive]);

  const driverLoc = snapshot?.driver.location;
  const riderLoc = snapshot?.rider.location;
  const viewerRole = snapshot?.viewerRole;

  const driverCoord: TripLiveCoord | null = driverLoc
    ? {
        latitude: driverLoc.latitude,
        longitude: driverLoc.longitude,
        heading:
          driverLoc.heading ??
          bearingDegrees(
            { latitude: driverLoc.latitude, longitude: driverLoc.longitude },
            to,
          ),
        speed: driverLoc.speed ?? undefined,
      }
    : viewerRole === "driver" && myLive
      ? {
          latitude: myLive.latitude,
          longitude: myLive.longitude,
          heading: myLive.heading ?? bearingDegrees(myLive, to),
          speed: myLive.speed,
        }
      : null;

  const riderCoord: TripLiveCoord | null = riderLoc
    ? {
        latitude: riderLoc.latitude,
        longitude: riderLoc.longitude,
        heading: riderLoc.heading ?? 0,
        speed: riderLoc.speed ?? undefined,
      }
    : viewerRole === "rider" && myLive
      ? {
          latitude: myLive.latitude,
          longitude: myLive.longitude,
          heading: myLive.heading ?? 0,
          speed: myLive.speed,
        }
      : null;

  const myCoord: TripLiveCoord | null = myLive
    ? {
        latitude: myLive.latitude,
        longitude: myLive.longitude,
        heading: myLive.heading ?? 0,
        speed: myLive.speed,
      }
    : null;

  const totalMiles = Math.max(0.1, distanceMiles(from, to));
  const remainingMiles = driverCoord
    ? distanceMiles(driverCoord, to)
    : totalMiles;
  const progress = Math.min(
    1,
    Math.max(0, 1 - remainingMiles / totalMiles),
  );

  const speedMph =
    driverCoord?.speed != null && driverCoord.speed > 1
      ? driverCoord.speed * 2.237
      : AVG_SPEED_MPH;
  const liveEta = Math.round((remainingMiles / speedMph) * 60);
  const routeEta =
    routeDurationSeconds != null
      ? Math.round((1 - progress) * (routeDurationSeconds / 60))
      : null;
  const etaMinutes = driverCoord
    ? Math.max(0, liveEta)
    : routeEta ?? Math.round(totalMiles / AVG_SPEED_MPH * 60);

  return {
    snapshot,
    loading,
    error,
    myCoord,
    driverCoord,
    riderCoord,
    progress,
    etaMinutes,
    etaSource: driverCoord ? "live" : "estimate",
    driverGpsLive: Boolean(driverLoc || (viewerRole === "driver" && myLive)),
    myGpsActive,
    locationError,
    hasPermission,
  };
}
