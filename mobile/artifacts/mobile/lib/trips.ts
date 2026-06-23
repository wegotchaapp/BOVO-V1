import { apiClient } from "./api";
import type { Trip, TripReply, TripPreferences } from "@/data/trips";

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
  preferences?: TripPreferences;
}

export async function listTrips(params?: {
  from?: string;
  to?: string;
}): Promise<Trip[]> {
  const q = new URLSearchParams();
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
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

export async function getTrip(
  id: string,
): Promise<{ trip: Trip; replies: TripReply[] }> {
  return apiClient.get<{ trip: Trip; replies: TripReply[] }>(`/trips/${id}`);
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const data = await apiClient.post<{ trip: Trip }>("/trips", input);
  return data.trip;
}

export async function deleteTrip(id: string): Promise<void> {
  await apiClient.delete<{ ok: true }>(`/trips/${id}`);
}

export async function replyToTrip(
  tripId: string,
  text: string,
): Promise<TripReply> {
  const data = await apiClient.post<{ reply: TripReply }>(
    `/trips/${tripId}/replies`,
    { text },
  );
  return data.reply;
}
