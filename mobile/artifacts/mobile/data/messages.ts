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

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    userId: "d1",
    userName: "John D.",
    lastMessage: "See you at 10 AM",
    time: "10:30 AM",
    unread: false,
    tripRoute: "Dallas → Austin",
  },
  {
    id: "c2",
    userId: "d2",
    userName: "Sarah M.",
    lastMessage: "Thanks!",
    time: "Yesterday",
    unread: false,
    tripRoute: "Dallas → Austin",
  },
  {
    id: "c3",
    userId: "d3",
    userName: "Mike R.",
    lastMessage: "Sounds good",
    time: "Yesterday",
    unread: false,
    tripRoute: "Austin → Houston",
  },
  {
    id: "c4",
    userId: "support",
    userName: "Support",
    lastMessage: "How can we help?",
    time: "May 20",
    unread: true,
  },
];

export const MOCK_CHAT_MESSAGES: Record<string, ChatMessage[]> = {
  c1: [
    {
      id: "m1",
      senderId: "d1",
      text: "Hey! Looking forward to the trip.",
      time: "9:00 AM",
      isMe: false,
    },
    {
      id: "m2",
      senderId: "me",
      text: "Me too! What's the pickup spot?",
      time: "9:15 AM",
      isMe: true,
    },
    {
      id: "m3",
      senderId: "d1",
      text: "Meet at the Starbucks on Main St, Dallas.",
      time: "9:20 AM",
      isMe: false,
    },
    { id: "m4", senderId: "me", text: "Perfect, see you there!", time: "9:22 AM", isMe: true },
    { id: "m5", senderId: "d1", text: "See you at 10 AM", time: "10:30 AM", isMe: false },
  ],
  c2: [
    {
      id: "m1",
      senderId: "d2",
      text: "Hi! Your booking is confirmed.",
      time: "Yesterday",
      isMe: false,
    },
    { id: "m2", senderId: "me", text: "Thanks!", time: "Yesterday", isMe: true },
  ],
  c3: [
    { id: "m1", senderId: "me", text: "Is there room for a small bag?", time: "Yesterday", isMe: true },
    { id: "m2", senderId: "d3", text: "Sounds good", time: "Yesterday", isMe: false },
  ],
  c4: [
    {
      id: "m1",
      senderId: "support",
      text: "Hello! How can we help you today?",
      time: "May 20",
      isMe: false,
    },
  ],
};
