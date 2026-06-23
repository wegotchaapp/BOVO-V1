import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  FlatList,
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

import { MOCK_CONVERSATIONS, MOCK_CHAT_MESSAGES, type ChatMessage } from "@/data/messages";
import { useColors } from "@/hooks/useColors";

export default function ChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conv = MOCK_CONVERSATIONS.find((c) => c.id === id);
  const [messages, setMessages] = useState<ChatMessage[]>(
    MOCK_CHAT_MESSAGES[id ?? "c1"] ?? [],
  );
  const [input, setInput] = useState("");
  const flatRef = useRef<FlatList>(null);

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      senderId: "me",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isMe: true,
    };
    setMessages((prev) => [...prev, msg]);
    setInput("");
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    return (
      <View style={[styles.msgRow, item.isMe && styles.msgRowMe]}>
        {!item.isMe && (
          <View style={[styles.smallAvatar, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.smallAvatarText, { color: colors.primary }]}>
              {(conv?.userName ?? "?")[0]}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.bubble,
            item.isMe
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
          ]}
        >
          <Text style={[styles.bubbleText, { color: item.isMe ? "#fff" : colors.foreground }]}>
            {item.text}
          </Text>
          <Text
            style={[
              styles.bubbleTime,
              { color: item.isMe ? "rgba(255,255,255,0.7)" : colors.mutedForeground },
            ]}
          >
            {item.time}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.foreground }]}>
            {conv?.userName ?? "Chat"}
          </Text>
          {conv?.tripRoute && (
            <Text style={[styles.headerRoute, { color: colors.primary }]}>{conv.tripRoute}</Text>
          )}
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
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
        />

        <View
          style={[
            styles.inputBar,
            { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.muted }]}
            onPress={sendMessage}
            disabled={!input.trim()}
          >
            <Feather name="send" size={18} color={input.trim() ? "#fff" : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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
  messagesList: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
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
  bubbleTime: { fontSize: 10, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
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
