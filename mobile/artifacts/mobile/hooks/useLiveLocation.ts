import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";

export interface LiveCoord {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
}

export interface UseLiveLocationResult {
  coord: LiveCoord | null;
  hasPermission: boolean | null;
  error: string | null;
  isTracking: boolean;
}

export function useLiveLocation(enabled = true): UseLiveLocationResult {
  const [coord, setCoord] = useState<LiveCoord | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function start() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;

        if (status !== "granted") {
          setHasPermission(false);
          setError("Location permission denied. Enable it in Settings to use live tracking.");
          return;
        }

        setHasPermission(true);

        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (cancelled) return;

        setCoord({
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
          heading: initial.coords.heading ?? undefined,
          speed: initial.coords.speed ?? undefined,
        });
        setIsTracking(true);

        subRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 10,
          },
          (loc) => {
            if (cancelled) return;
            setCoord({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading ?? undefined,
              speed: loc.coords.speed ?? undefined,
            });
          },
        );
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to start location tracking.");
      }
    }

    start();

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
      setIsTracking(false);
    };
  }, [enabled]);

  return { coord, hasPermission, error, isTracking };
}
