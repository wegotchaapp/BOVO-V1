import { apiClient } from "./api";

export async function getRatingStatus(
  bookingId: string,
): Promise<{ rated: boolean }> {
  return apiClient.get<{ rated: boolean }>(`/ratings/status/${bookingId}`);
}

export async function submitRating(input: {
  bookingId: string;
  score: number;
  comment?: string;
  tags?: string[];
}): Promise<void> {
  await apiClient.post("/ratings", input);
}
