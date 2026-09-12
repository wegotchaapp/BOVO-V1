import { apiClient } from "./api";
import type { Trip, TripReply, TripPreferences, TripDetailMeta } from "@/data/trips";

export interface CreateTripInput {
  fromCity: string;
  toCity: string;
  /** ISO timestamp */
  departureAt: string;
  seatsAvailable: number;
  luggageSpace?: number;
  pricePerSeat: number;
  note?: string;
  car?: string;
  /** One of the Voyager's approved vehicles. Omitted, the server uses the newest. */
  vehicleId?: string;
  preferences?: TripPreferences;
}

export async function listTrips(params?: {
  from?: string;
  to?: string;
  /** ISO calendar day, YYYY-MM-DD. Omit to search every upcoming day. */
  date?: string;
}): Promise<Trip[]> {
  const q = new URLSearchParams();
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.date) q.set("date", params.date);
  const qs = q.toString();
  const data = await apiClient.get<{ trips: Trip[] }>(
    `/trips${qs ? `?${qs}` : ""}`,
  );
  return data.trips;
}

export async function listMyTrips(): Promise<Trip[]> {
  const data = await apiClient.get<{ trips: Trip[] }>("/trips/mine");
  return data.trips;
}

/** `replies` is always empty now that posts take no public replies. */
export async function getTrip(
  id: string,
): Promise<{ trip: Trip; replies: TripReply[]; meta: TripDetailMeta }> {
  return apiClient.get<{ trip: Trip; replies: TripReply[]; meta: TripDetailMeta }>(
    `/trips/${id}`,
  ).then((data) => ({
    ...data,
    meta: data.meta ?? {
      bookedRiderIds: [],
      viewerHasBooked: false,
      viewerGroupId: null,
    },
  }));
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const data = await apiClient.post<{ trip: Trip }>("/trips", input);
  return data.trip;
}

export async function deleteTrip(id: string): Promise<void> {
  await apiClient.delete<{ ok: true }>(`/trips/${id}`);
}

/**
 * Uploads the mandatory pre-trip vehicle video recorded live with the camera.
 * The backend refuses to start the trip until this succeeds.
 */
export async function uploadStartVideo(
  tripId: string,
  fileUri: string,
): Promise<{ startVideoUrl: string }> {
  const name = fileUri.split("/").pop() || "start-video.mp4";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "mp4";
  const mimeByExt: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    "3gp": "video/3gpp",
    mkv: "video/x-matroska",
  };
  const form = new FormData();
  form.append("video", {
    uri: fileUri,
    name,
    type: mimeByExt[ext] ?? "video/mp4",
  } as unknown as Blob);
  return apiClient.postForm<{ ok: true; startVideoUrl: string }>(
    `/trips/${tripId}/start-video`,
    form,
  );
}

/** Marks the trip started (requires the start video to be uploaded first). */
export async function startTrip(tripId: string): Promise<Trip> {
  const data = await apiClient.post<{ trip: Trip }>(`/trips/${tripId}/start`);
  return data.trip;
}
