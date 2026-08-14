import { apiClient } from "./api";

/**
 * Odometer capture: at each pickup and each dropoff the Voyager photographs the
 * dashboard and types the reading, which gives us the exact miles each Sailor
 * was carried.
 */

export type LegStatus = "awaiting_pickup" | "on_board" | "dropped_off";
export type ReadingKind = "pickup" | "dropoff";

export interface ManifestEntry {
  bookingId: string;
  sailorId: string;
  sailorName: string;
  sailorPhotoUrl: string | null;
  seats: number;
  status: LegStatus;
  pickupMiles: number | null;
  dropoffMiles: number | null;
  milesTravelled: number | null;
  pickedUpAt: string | null;
  droppedOffAt: string | null;
}

export interface Manifest {
  tripId: string;
  tripStatus: "active" | "in_progress" | "cancelled" | "completed";
  startVideoRecorded: boolean;
  /** Highest reading logged so far — the floor for the next entry. */
  lastOdometerMiles: number | null;
  entries: ManifestEntry[];
}

export interface RecordResult {
  ok: true;
  reading: {
    bookingId: string;
    kind: ReadingKind;
    miles: number;
    photoUrl: string;
    recordedAt: string;
  };
  milesTravelled: number | null;
  tripCompleted: boolean;
  manifest: Manifest;
}

export async function getManifest(tripId: string): Promise<Manifest> {
  return apiClient.get<Manifest>(`/trips/${tripId}/manifest`);
}

/** The next action for a Sailor, or null once their leg is finished. */
export function nextKindFor(entry: ManifestEntry): ReadingKind | null {
  if (entry.status === "awaiting_pickup") return "pickup";
  if (entry.status === "on_board") return "dropoff";
  return null;
}

export async function recordOdometerReading(input: {
  tripId: string;
  bookingId: string;
  kind: ReadingKind;
  miles: number;
  photoUri: string;
  latitude?: number;
  longitude?: number;
}): Promise<RecordResult> {
  const name = input.photoUri.split("/").pop() || "odometer.jpg";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "jpg";
  const mimeByExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    heic: "image/heic",
    webp: "image/webp",
  };

  const form = new FormData();
  form.append("photo", {
    uri: input.photoUri,
    name,
    type: mimeByExt[ext] ?? "image/jpeg",
  } as unknown as Blob);
  form.append("bookingId", input.bookingId);
  form.append("kind", input.kind);
  form.append("miles", String(input.miles));
  if (input.latitude != null) form.append("latitude", String(input.latitude));
  if (input.longitude != null) form.append("longitude", String(input.longitude));

  return apiClient.postForm<RecordResult>(`/trips/${input.tripId}/odometer`, form);
}
