import { Platform, Share } from "react-native";

import { getSosLocation } from "./safety";

export interface TripShareInput {
  fromCity: string;
  toCity: string;
  departureAt: string;
  pricePerSeat?: number;
  driverName?: string;
}

function cityShort(c: string): string {
  return c.replace(/, TX$/i, "").replace(/, AR$/i, "").trim();
}

function formatShareDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface LiveShareInput {
  fromCity?: string;
  toCity?: string;
  /** ISO timestamp of the expected arrival, when a trip is under way. */
  etaAt?: string | null;
  contactName?: string | null;
}

/**
 * Shares the user's real live GPS position plus route/ETA through the OS share
 * sheet, so it can go to any contact or messaging app. Returns false when no
 * location fix could be obtained, so the caller can explain why.
 */
export async function shareLiveLocation(input: LiveShareInput = {}): Promise<boolean> {
  const coord = await getSosLocation();
  if (!coord) return false;

  const parts = ["I'm sharing my live Bovogo adventure with you."];
  if (input.fromCity && input.toCity) {
    parts.push(`Route: ${cityShort(input.fromCity)} → ${cityShort(input.toCity)}`);
  }
  if (input.etaAt) {
    parts.push(`ETA: ${formatShareDate(input.etaAt)}`);
  }
  parts.push(
    `My live location: https://www.google.com/maps?q=${coord.latitude},${coord.longitude}`,
  );

  const message = parts.join("\n");
  await Share.share(
    Platform.OS === "ios" ? { message } : { message, title: "My live Bovogo adventure" },
  );
  return true;
}

export async function shareTripSummary(input: TripShareInput): Promise<void> {
  const from = cityShort(input.fromCity);
  const to = cityShort(input.toCity);
  const when = formatShareDate(input.departureAt);
  const price =
    input.pricePerSeat != null ? ` · $${input.pricePerSeat}/seat` : "";
  const driver = input.driverName ? ` with ${input.driverName}` : "";
  const message = `Join this Bovogo adventure: ${from} → ${to} on ${when}${price}${driver}`;

  await Share.share(
    Platform.OS === "ios" ? { message } : { message, title: "Bovogo adventure" },
  );
}
