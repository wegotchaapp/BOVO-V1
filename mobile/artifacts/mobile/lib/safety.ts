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

/** Why an SOS has no coordinates, so the screen can say something useful. */
export type SosLocationFailure = "permission_denied" | "unavailable";

export interface SosLocationResult {
  coord: SosCoord | null;
  /** Only set when `coord` is null. */
  reason?: SosLocationFailure;
}

/**
 * How long to wait for a fresh fix before falling back to the last known one.
 *
 * `getCurrentPositionAsync` has no timeout of its own and can sit for a long
 * while indoors. An SOS cannot wait on a perfect fix: a slightly stale position
 * dispatched now beats an exact one dispatched in a minute.
 */
const FRESH_FIX_TIMEOUT_MS = 4_000;

/** True when foreground location has been granted, without prompting for it. */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Best-effort current GPS fix, falling back to the last known position.
 *
 * Reports *why* it came back empty. Noonlight cannot open an alarm without
 * coordinates, so "no location" is the difference between an SOS that reaches a
 * dispatcher and one that does not — the caller has to be able to say so.
 */
export async function getSosLocation(): Promise<SosLocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return { coord: null, reason: "permission_denied" };

    const last = await Location.getLastKnownPositionAsync().catch(() => null);

    try {
      const fresh = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), FRESH_FIX_TIMEOUT_MS),
        ),
      ]);
      return {
        coord: {
          latitude: fresh.coords.latitude,
          longitude: fresh.coords.longitude,
        },
      };
    } catch {
      if (last) {
        return {
          coord: {
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
          },
        };
      }
      return { coord: null, reason: "unavailable" };
    }
  } catch {
    return { coord: null, reason: "unavailable" };
  }
}

export interface SosNotifyResult {
  contactNotified: boolean;
  /** Whether a Noonlight alarm was actually opened for this activation. */
  dispatched: boolean;
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
      dispatched: Boolean(r?.dispatched),
      reason: r?.reason,
    }))
    .catch(() => ({
      contactNotified: false,
      dispatched: false,
      reason: "request_failed",
    }));
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
 * 2. Start the backend notify (Noonlight dispatch + Twilio SMS to the contact).
 * 3. Open the 911 SMS composer with "Help required" + live location.
 * 4. When the composer closes, open the dialer with 911 ready.
 *
 * The notify is started but deliberately not awaited before the 911 steps —
 * reaching emergency services must never wait on our API.
 *
 * `onResult` fires the moment the backend answers, rather than after the 911
 * handoff. The handoff is not a normal await: on web `Linking.openURL("tel:")`
 * assigns `window.location`, and on a device it sends the app to the background.
 * Anything waiting behind it — including telling the user that nobody was
 * dispatched — may never run at all.
 */
export type SosOutcome = SosNotifyResult & { locationReason?: SosLocationFailure };

export async function triggerSos(options?: {
  coord?: SosCoord | null;
  tripId?: string;
  /** Called as soon as the backend answers, before the 911 handoff. */
  onResult?: (outcome: SosOutcome) => void;
  /**
   * Called *synchronously*, before anything else, when there is no location.
   *
   * Dispatch needs coordinates, so with none we already know no responders can
   * be sent — no network round trip required. Saying so here is the only way it
   * reliably reaches the user: `onResult` waits on the API, and the 911 handoff
   * that follows navigates the page on web and backgrounds the app on a device.
   */
  onNoLocation?: (reason: SosLocationFailure) => void;
}): Promise<SosOutcome> {
  let coord = options?.coord ?? null;
  let locationReason: SosLocationFailure | undefined;

  if (!coord) {
    const located = await getSosLocation();
    coord = located.coord;
    locationReason = located.reason;
  }

  if (!coord) {
    options?.onNoLocation?.(locationReason ?? "unavailable");
  }

  const notified = notifyBackendSos(coord, options?.tripId).then((r) => {
    const outcome: SosOutcome = { ...r, locationReason };
    options?.onResult?.(outcome);
    return outcome;
  });

  await openSms911(coord);
  await openCall911();
  return notified;
}
