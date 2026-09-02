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
 * Whether a phone/SMS handoff actually reached the OS.
 *
 * `unavailable_on_web` is not an error — it is the deliberate refusal below.
 */
export type HandoffResult = "opened" | "unavailable_on_web" | "failed";

/**
 * Opens the system dialer for `phone`, or says why it could not.
 *
 * **Web deliberately does nothing.** react-native-web implements
 * `Linking.openURL("tel:")` as `window.location = url`, which unloads the
 * running app — mid-SOS that is the worst possible moment, because everything
 * queued behind it (including telling the user nobody was dispatched) dies with
 * the page. Its `canOpenURL()` also always resolves `true` and `openURL()` never
 * rejects, so a caller's own `catch` or `canOpenURL` guard can detect none of
 * this. Callers must show the number instead when this returns anything but
 * `"opened"` — the returned value is the only signal they get.
 */
export async function openDialer(phone: string): Promise<HandoffResult> {
  if (Platform.OS === "web") return "unavailable_on_web";
  try {
    await Linking.openURL(`tel:${phone}`);
    return "opened";
  } catch {
    return "failed";
  }
}

/**
 * Opens the system SMS composer addressed to 911 with the help message and
 * live location prefilled. The OS requires the user to tap Send themselves.
 *
 * Web is refused for the same reason as `openDialer`: react-native-web sends
 * `sms:` through `window.open`, which is silently swallowed by popup blockers
 * while still resolving as though it worked.
 */
export async function openSms911(coord: SosCoord | null): Promise<HandoffResult> {
  if (Platform.OS === "web") return "unavailable_on_web";

  const body = coord
    ? `Help required. My live location: ${mapsUrl(coord)}`
    : "Help required.";
  try {
    if (await SMS.isAvailableAsync()) {
      await SMS.sendSMSAsync(["911"], body);
      return "opened";
    }
  } catch {
    // Fall through to the sms: URL below.
  }
  const separator = Platform.OS === "ios" ? "&" : "?";
  try {
    await Linking.openURL(`sms:911${separator}body=${encodeURIComponent(body)}`);
    return "opened";
  } catch {
    return "failed";
  }
}

/**
 * Shown when the dialer did not open and the user has to place the call.
 *
 * Phrased as an instruction, never as a claim about what the app just did —
 * copy asserting "the 911 call your phone just opened" is false wherever the
 * handoff was refused, which is exactly when the user most needs the truth.
 */
export const MANUAL_CALL_911_MESSAGE =
  "Bovogo couldn't open the dialer on this device. Call 911 yourself now — that call is the fastest route to help.";

/** Opens the phone dialer with 911 ready; the user taps once to call. */
export async function openCall911(): Promise<HandoffResult> {
  return openDialer("911");
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
 * handoff. The handoff is not a normal await: on a device it sends the app to
 * the background, so anything waiting behind it — including telling the user
 * that nobody was dispatched — may never run at all.
 *
 * On web both handoffs are refused rather than attempted (see `openDialer`), so
 * steps 3 and 4 are no-ops there and `onManualCall` carries the whole message.
 * That refusal is what makes this flow testable on Expo web at all: it used to
 * unload the app partway through.
 */
export type SosOutcome = SosNotifyResult & {
  locationReason?: SosLocationFailure;
  /**
   * Whether the 911 dialer actually opened. Anything but `"opened"` means the
   * user still has to place the call themselves and must be told so.
   */
  callHandoff?: HandoffResult;
};

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
  /**
   * Called when the 911 dialer did not open and the user must call themselves.
   *
   * On web this always fires, by design — see `openDialer`. Screens are expected
   * to put the number on screen in response, because nothing else will.
   */
  onManualCall?: (result: HandoffResult) => void;
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

  let callHandoff: HandoffResult | undefined;

  const notified = notifyBackendSos(coord, options?.tripId).then((r) => {
    const outcome: SosOutcome = { ...r, locationReason, callHandoff };
    options?.onResult?.(outcome);
    return outcome;
  });

  await openSms911(coord);
  callHandoff = await openCall911();

  // Fired here rather than inside `onResult`, which waits on the API: on web
  // both handoffs are refused outright, so this is the only thing that tells
  // the user a call still has to happen — and it must not queue behind a
  // network round trip during an emergency.
  if (callHandoff !== "opened") options?.onManualCall?.(callHandoff);

  return notified.then((outcome) => ({ ...outcome, callHandoff }));
}
