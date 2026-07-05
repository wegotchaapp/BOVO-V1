/** Types for direct messages — data is loaded from `/api/conversations`. */

export interface Conversation {
  id: string;
  userId: string;
  userName: string;
  lastMessage: string;
  time: string;
  unread: boolean;
  tripRoute?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  time: string;
  isMe: boolean;
}
