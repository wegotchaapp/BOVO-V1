import { apiClient } from "./api";

export interface Conversation {
  id: string;
  userId: string;
  userName: string;
  lastMessage: string;
  time: string;
  unread: boolean;
  tripRoute?: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  time: string;
  isMe: boolean;
  createdAt?: string;
}

export async function listMyConversations(): Promise<Conversation[]> {
  const data = await apiClient.get<{ conversations: Conversation[] }>(
    "/conversations/mine",
  );
  return data.conversations;
}

export async function getConversation(
  id: string,
): Promise<{ conversation: Conversation; messages: ChatMessage[] }> {
  return apiClient.get<{ conversation: Conversation; messages: ChatMessage[] }>(
    `/conversations/${id}`,
  );
}

export async function postConversationMessage(
  id: string,
  text: string,
): Promise<ChatMessage> {
  const data = await apiClient.post<{ message: ChatMessage }>(
    `/conversations/${id}/messages`,
    { text },
  );
  return data.message;
}

export async function openConversation(
  otherUserId: string,
  tripLabel?: string,
): Promise<Conversation> {
  const data = await apiClient.post<{ conversation: Conversation }>(
    "/conversations",
    { otherUserId, tripLabel },
  );
  return data.conversation;
}

export async function openSupportConversation(): Promise<Conversation> {
  const data = await apiClient.post<{ conversation: Conversation }>(
    "/conversations/support",
    {},
  );
  return data.conversation;
}
