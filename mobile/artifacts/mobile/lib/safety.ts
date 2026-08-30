import * as Location from "expo-location";
import * as SMS from "expo-sms";
import { Linking, Platform } from "react-native";

import { apiClient } from "./api";

export interface SosCoord {
  latitude: number;
  longitude: number;
}

function mapsUrl(coord: SosCoord): string {
  return `https://www.google.com/maps?q=${coord.latitude},${coord.longitude}`;
}

/** How long the SOS flow waits for a fresh fix before using the cached one. */
const FRESH_FIX_TIMEOUT_MS = 5_000;

/**
 * Best-effort current GPS fix. Falls back to the last known position so the
 * SOS flow is never blocked waiting on a fresh fix.
 */
export async function getSosLocation(): Promise<SosCoord | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;

    const last = await Location.getLastKnownPositionAsync();
    const cached: SosCoord | null = last
      ? { latitude: last.coords.latitude, longitude: last.coords.longitude }
      : null;

    // getCurrentPositionAsync rejects on error but never on slowness — indoors
    // or in a tunnel it hunts for a fix indefinitely. Cap the wait so an
    // emergency is never held up behind it.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), FRESH_FIX_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(timer);

    if (fresh) {
      return {
        latitude: fresh.coords.latitude,
        longitude: fresh.coords.longitude,
      };
    }
    return cached;
  } catch {
    return null;
  }
}

/** Notifies the backend so the user's emergency contact gets a Twilio SMS. */
export function notifyBackendSos(coord: SosCoord | null, tripId?: string): void {
  apiClient
    .post("/safety/sos", {
      ...(coord ? { latitude: coord.latitude, longitude: coord.longitude } : {}),
      ...(tripId ? { tripId } : {}),
    })
    .catch(() => {
      // Fire-and-forget: the device-side 911 flow must not be blocked.
    });
}

/**
 * Opens the system SMS composer addressed to 911 with the help message and
 * live location prefilled. The OS requires the user to tap Send themselves.
 */
export async function openSms911(coord: SosCoord | null): Promise<void> {
  const body = coord
    ? `Help required. My live location: ${mapsUrl(coord)}`
    : "Help required.";
  try {
    if (Platform.OS !== "web" && (await SMS.isAvailableAsync())) {
      await SMS.sendSMSAsync(["911"], body);
      return;
    }
  } catch {
    // Fall through to the sms: URL below.
  }
  const separator = Platform.OS === "ios" ? "&" : "?";
  await Linking.openURL(`sms:911${separator}body=${encodeURIComponent(body)}`).catch(
    () => {},
  );
}

/** Opens the phone dialer with 911 ready; the user taps once to call. */
export async function openCall911(): Promise<void> {
  await Linking.openURL("tel:911").catch(() => {});
}

/**
 * Full SOS flow:
 * 1. Grab the freshest location available.
 * 2. Auto-notify the backend (Twilio SMS to the emergency contact).
 * 3. Open the 911 SMS composer with "Help required" + live location.
 * 4. When the composer closes, open the dialer with 911 ready.
 */
export async function triggerSos(options?: {
  coord?: SosCoord | null;
  tripId?: string;
}): Promise<void> {
  const coord = options?.coord ?? (await getSosLocation());
  notifyBackendSos(coord, options?.tripId);
  await openSms911(coord);
  await openCall911();
}
