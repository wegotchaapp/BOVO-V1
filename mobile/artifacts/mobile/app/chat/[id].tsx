import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { showAlert } from "@/lib/alert";
import {
  getConversation,
  postConversationMessage,
  type ChatMessage,
  type Conversation,
} from "@/lib/conversations";

const POLL_MS = 4000;

export default function ChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const flatRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getConversation(id);
      setConversation(data.conversation);
      setMessages(data.messages);
    } catch (err: any) {
      showAlert("Couldn't load chat", err?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || !id || sending) return;
    setSending(true);
    const tempId = `tmp_${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      senderId: "me",
      text,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isMe: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    try {
      const real = await postConversationMessage(id, text);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m)));
      setConversation((c) =>
        c
          ? {
              ...c,
              lastMessage: real.text,
              time: real.time,
              unread: false,
            }
          : c,
      );
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      showAlert("Couldn't send", err?.message ?? "Please try again.");
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    return (
      <View style={[styles.msgRow, item.isMe && styles.msgRowMe]}>
        {!item.isMe && (
          <View style={[styles.smallAvatar, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.smallAvatarText, { color: colors.primary }]}>
              {(conversation?.userName ?? "?")[0]}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.bubble,
            item.isMe
              ? { backgroundColor: colors.primary }
              : {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: item.isMe ? "#fff" : colors.foreground },
            ]}
          >
            {item.text}
          </Text>
          <Text
            style={[
              styles.bubbleTime,
              {
                color: item.isMe
                  ? "rgba(255,255,255,0.7)"
                  : colors.mutedForeground,
              },
            ]}
          >
            {item.time}
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safe, styles.center, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity
          onPress={() => {
            Keyboard.dismiss();
            router.back();
          }}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.foreground }]}>
            {conversation?.userName ?? "Chat"}
          </Text>
          {conversation?.tripRoute ? (
            <Text style={[styles.headerRoute, { color: colors.primary }]}>
              {conversation.tripRoute}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(i) => i.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() =>
            flatRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>
                Say hello — messages are saved securely.
              </Text>
            </View>
          }
        />

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={sendMessage}
            editable={!sending}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              {
                backgroundColor:
                  input.trim() && !sending ? colors.primary : colors.muted,
              },
            ]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
          >
            <Feather
              name="send"
              size={18}
              color={
                input.trim() && !sending ? "#fff" : colors.mutedForeground
              }
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  headerInfo: { flex: 1, gap: 2 },
  headerName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerRoute: { fontSize: 12, fontFamily: "Inter_500Medium" },
  messagesList: { paddingHorizontal: 16, paddingVertical: 12, gap: 12, flexGrow: 1 },
  emptyChat: { paddingTop: 40, paddingHorizontal: 24 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  msgRowMe: { flexDirection: "row-reverse" },
  smallAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  smallAvatarText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  bubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
    gap: 4,
  },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bubbleTime: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    alignSelf: "flex-end",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
