import { apiClient } from "./api";

export interface PickupHubMeta {
  hubId: string;
  brand: "walmart" | "target";
  storeName: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

export interface TripGroupSummary {
  id: string;
  tripId: string;
  fromCity: string;
  toCity: string;
  departureAt: string;
  memberCount: number;
  pickupLocked: boolean;
  pickupHubId: string | null;
  pickupHub: PickupHubMeta | null;
  latestMessage: string | null;
  createdAt: string;
}

export interface TripGroupMember {
  userId: string;
  name: string;
  role: "driver" | "rider";
  joinedAt: string;
}

export interface TripGroupMessage {
  id: string;
  senderId: string | null;
  senderName: string | null;
  text: string;
  isSystem: boolean;
  createdAt: string;
}

export interface TripGroupDetail {
  group: TripGroupSummary;
  members: TripGroupMember[];
  messages: TripGroupMessage[];
}

export async function listMyGroups(): Promise<TripGroupSummary[]> {
  const data = await apiClient.get<{ groups: TripGroupSummary[] }>("/groups/mine");
  return data.groups;
}

export async function getGroup(id: string): Promise<TripGroupDetail> {
  return apiClient.get<TripGroupDetail>(`/groups/${id}`);
}

export async function postGroupMessage(
  id: string,
  text: string,
): Promise<TripGroupMessage> {
  const data = await apiClient.post<{ message: TripGroupMessage }>(
    `/groups/${id}/messages`,
    { text },
  );
  return data.message;
}

export async function deleteGroup(id: string): Promise<void> {
  await apiClient.delete(`/groups/${id}`);
}
