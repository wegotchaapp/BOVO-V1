import { Platform, Share } from "react-native";

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
