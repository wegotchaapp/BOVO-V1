/**
 * Simulates a driver moving along the route from `from` to `to`.
 * Uses real route duration from Mapbox Directions API when available
 * (passed in via routeDurationSeconds after the map fetches the route).
 * In production this would be replaced by a WebSocket/Supabase real-time
 * subscription receiving the driver's actual GPS coords.
 */
import { useEffect, useRef, useState } from "react";

export interface SimCoord {
  latitude: number;
  longitude: number;
  heading: number;
}

export interface UseDriverSimulationResult {
  driverCoord: SimCoord;
  progress: number;
  etaMinutes: number;
  etaSource: "mapbox" | "estimate";
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function bearing(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function useDriverSimulation(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  initialProgress = 0.32,
  /** Fallback duration in minutes used before Mapbox data arrives */
  fallbackDurationMinutes = 195,
  /** Real driving duration in seconds from Mapbox Directions API */
  routeDurationSeconds?: number,
): UseDriverSimulationResult {
  const [progress, setProgress] = useState(initialProgress);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prefer Mapbox real duration; fall back to estimate until route loads
  const effectiveDurationMinutes = routeDurationSeconds
    ? routeDurationSeconds / 60
    : fallbackDurationMinutes;

  const TICK_MS = 4000;
  const PROGRESS_PER_TICK = TICK_MS / (effectiveDurationMinutes * 60 * 1000);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setProgress((prev) => Math.min(1, prev + PROGRESS_PER_TICK));
    }, TICK_MS);
    return () => { clearInterval(intervalRef.current!); };
  }, [PROGRESS_PER_TICK]);

  const driverCoord: SimCoord = {
    latitude: lerp(from.latitude, to.latitude, progress),
    longitude: lerp(from.longitude, to.longitude, progress),
    heading: bearing(from, to),
  };

  const remainingFraction = Math.max(0, 1 - progress);
  const etaMinutes = Math.round(remainingFraction * effectiveDurationMinutes);

  return {
    driverCoord,
    progress,
    etaMinutes,
    etaSource: routeDurationSeconds ? "mapbox" : "estimate",
  };
}
