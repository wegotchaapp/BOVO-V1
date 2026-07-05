import { apiClient } from "./api";

export async function getMyPreferences(): Promise<{
  preferences: Record<string, string>;
  preferencesCount: number;
}> {
  return apiClient.get("/preferences/me");
}

export async function saveMyPreferences(
  preferences: Record<string, string>,
): Promise<{ preferences: Record<string, string>; preferencesCount: number }> {
  return apiClient.put("/preferences/me", { preferences });
}
