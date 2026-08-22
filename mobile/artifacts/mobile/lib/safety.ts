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

/**
 * Best-effort current GPS fix. Falls back to the last known position so the
 * SOS flow is never blocked waiting on a fresh fix.
 */
export async function getSosLocation(): Promise<SosCoord | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const last = await Location.getLastKnownPositionAsync();
    try {
      const fresh = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: fresh.coords.latitude,
        longitude: fresh.coords.longitude,
      };
    } catch {
      if (last) {
        return {
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
        };
      }
      return null;
    }
  } catch {
    return null;
  }
}

export interface SosNotifyResult {
  contactNotified: boolean;
  reason?: string;
}

/**
 * Notifies the backend so the user's emergency contact gets a Twilio SMS.
 *
 * Never rejects — the device-side 911 flow must not be blocked or derailed by a
 * network failure. It does resolve with whether the contact was actually reached,
 * because silently failing to alert someone while telling the user you did is the
 * worst outcome this screen can produce.
 */
export function notifyBackendSos(
  coord: SosCoord | null,
  tripId?: string,
): Promise<SosNotifyResult> {
  return apiClient
    .post<SosNotifyResult>("/safety/sos", {
      ...(coord ? { latitude: coord.latitude, longitude: coord.longitude } : {}),
      ...(tripId ? { tripId } : {}),
    })
    .then((r) => ({
      contactNotified: Boolean(r?.contactNotified),
      reason: r?.reason,
    }))
    .catch(() => ({ contactNotified: false, reason: "request_failed" }));
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
 * 2. Start the backend notify (Twilio SMS to the emergency contact).
 * 3. Open the 911 SMS composer with "Help required" + live location.
 * 4. When the composer closes, open the dialer with 911 ready.
 *
 * Resolves with whether the emergency contact was reached, so a caller can tell
 * the user when it was not. The notify is started but deliberately not awaited
 * before the 911 steps — reaching emergency services must never wait on our API.
 */
export async function triggerSos(options?: {
  coord?: SosCoord | null;
  tripId?: string;
}): Promise<SosNotifyResult> {
  const coord = options?.coord ?? (await getSosLocation());
  const notified = notifyBackendSos(coord, options?.tripId);
  await openSms911(coord);
  await openCall911();
  return notified;
}
