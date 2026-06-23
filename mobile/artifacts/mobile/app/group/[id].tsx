import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import {
  deleteGroup,
  getGroup,
  postGroupMessage,
  type TripGroupDetail,
  type TripGroupMessage,
} from "@/lib/groups";

const POLL_INTERVAL_MS = 4000;

function cityShort(c: string): string {
  return c.replace(/, TX$/, "").replace(/, AR$/, "");
}

function formatTripDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })} · ${d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function BrandBadge({ brand }: { brand: "walmart" | "target" }) {
  const isWalmart = brand === "walmart";
  return (
    <View
      style={[
        styles.brandBadge,
        { backgroundColor: isWalmart ? "#FFC220" : "#CC0000" },
      ]}
    >
      <Text
        style={[
          styles.brandBadgeText,
          { color: isWalmart ? "#0071CE" : "#fff" },
        ]}
      >
        {isWalmart ? "WALMART" : "TARGET"}
      </Text>
    </View>
  );
}

export default function GroupDetail() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [data, setData] = useState<TripGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // We keep the latest detail in a ref so the polling closure always sees
  // fresh state without restarting the interval on every data change.
  const dataRef = useRef<TripGroupDetail | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const load = useCallback(async (): Promise<TripGroupDetail | null> => {
    if (!id) return null;
    try {
      const detail = await getGroup(id);
      setData(detail);
      setError(null);
      return detail;
    } catch (err: any) {
      setError(err?.message || "Couldn't load this group.");
      return null;
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load().finally(() => {
        if (!cancelled) setLoading(false);
      });

      // Lightweight polling for new messages / lock events while focused.
      // 4s matches the existing live-tracking cadence (per replit.md).
      const interval = setInterval(() => {
        if (cancelled) return;
        getGroup(id!)
          .then((detail) => {
            if (cancelled) return;
            setData(detail);
            setError(null);
          })
          .catch(() => {
            // Soft-fail: keep showing the previous snapshot.
          });
      }, POLL_INTERVAL_MS);

      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, [id, load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function onSend() {
    const text = composerText.trim();
    if (!text || !id || sending) return;
    setSending(true);
    // Optimistic insert so the bubble feels instant.
    const tempId = `tmp_${Date.now()}`;
    const optimistic: TripGroupMessage = {
      id: tempId,
      senderId: user?.id ?? null,
      senderName: user?.name ?? "You",
      text,
      isSystem: false,
      createdAt: new Date().toISOString(),
    };
    setData((d) =>
      d ? { ...d, messages: [...d.messages, optimistic] } : d,
    );
    setComposerText("");
    try {
      const real = await postGroupMessage(id, text);
      setData((d) =>
        d
          ? {
              ...d,
              messages: d.messages.map((m) => (m.id === tempId ? real : m)),
            }
          : d,
      );
    } catch (err: any) {
      // Roll back the optimistic message.
      setData((d) =>
        d ? { ...d, messages: d.messages.filter((m) => m.id !== tempId) } : d,
      );
      setComposerText(text);
      Alert.alert("Couldn't send", err?.message || "Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Adventure Group</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Adventure Group</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Feather name="alert-circle" size={36} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>
            {error || "Group unavailable."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { group, members, messages } = data;
  const isMember = !!members.find((m) => m.userId === user?.id);
  const isDriver = !!members.find((m) => m.userId === user?.id && m.role === "driver");

  function onDeleteGroup() {
    Alert.alert(
      "Delete Adventure Group",
      "This will permanently remove the group, all messages, and all members. This cannot be undone.",
      [
        { text: "Don't Delete", style: "cancel" },
        {
          text: "Delete Group",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteGroup(id!);
              router.back();
            } catch (err: any) {
              Alert.alert("Couldn't delete group", err?.message || "Please try again.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
              {cityShort(group.fromCity)} → {cityShort(group.toCity)}
            </Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {group.memberCount} member{group.memberCount === 1 ? "" : "s"} ·{" "}
              {formatTripDate(group.departureAt)}
            </Text>
          </View>
          {isDriver ? (
            <TouchableOpacity
              style={[styles.headerBtn, styles.deleteHeaderBtn]}
              onPress={onDeleteGroup}
              disabled={deleting}
              activeOpacity={0.75}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Feather name="trash-2" size={18} color="#DC2626" />
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* ── Members ──────────────────────────────────────────────────────── */}
          <View style={[styles.membersCard, CARD_SHADOW]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MEMBERS</Text>
            <View style={styles.membersRow}>
              {members.map((m) => (
                <View key={m.userId} style={styles.memberChip}>
                  <View
                    style={[
                      styles.memberAvatar,
                      {
                        backgroundColor:
                          m.role === "driver" ? colors.primary : colors.secondary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.memberInitials,
                        { color: m.role === "driver" ? "#fff" : colors.primary },
                      ]}
                    >
                      {initials(m.name)}
                    </Text>
                  </View>
                  <Text style={[styles.memberName, { color: colors.foreground }]} numberOfLines={1}>
                    {m.userId === user?.id ? "You" : m.name.split(" ")[0]}
                  </Text>
                  {m.role === "driver" && (
                    <View style={[styles.driverTag, { backgroundColor: "#FEF3E2" }]}>
                      <Text style={[styles.driverTagText, { color: "#C4954A" }]}>Voyager</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* ── Activity / messages ──────────────────────────────────────────── */}
          <View style={styles.activityHeader}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACTIVITY</Text>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Group chat
            </Text>
          </View>
          {messages.map((m) => {
            if (m.isSystem) {
              return (
                <View key={m.id} style={[styles.systemBubble, { backgroundColor: colors.muted }]}>
                  <View style={styles.systemRow}>
                    <Feather name="info" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.systemText, { color: colors.mutedForeground }]}>
                      {m.text}
                    </Text>
                  </View>
                </View>
              );
            }
            const mine = m.senderId === user?.id;
            return (
              <View
                key={m.id}
                style={[
                  styles.userBubble,
                  mine
                    ? [styles.userBubbleMine, { backgroundColor: colors.primary }]
                    : [styles.userBubbleTheirs, CARD_SHADOW, { backgroundColor: "#fff" }],
                ]}
              >
                {!mine && (
                  <Text style={[styles.userName, { color: colors.primary }]}>
                    {m.senderName || "Member"}
                  </Text>
                )}
                <Text style={[styles.userText, { color: mine ? "#fff" : colors.foreground }]}>
                  {m.text}
                </Text>
                <Text
                  style={[
                    styles.userTime,
                    { color: mine ? "rgba(255,255,255,0.7)" : colors.mutedForeground },
                  ]}
                >
                  {formatBubbleTime(m.createdAt)}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* ── Composer ─────────────────────────────────────────────────────── */}
        <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <View style={[styles.composerInputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <TextInput
              style={[styles.composerInput, { color: colors.foreground }]}
              placeholder="Message the group"
              placeholderTextColor={colors.mutedForeground}
              value={composerText}
              onChangeText={setComposerText}
              multiline
              maxLength={2000}
              editable={isMember && !sending}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.sendBtn,
              {
                backgroundColor: composerText.trim() ? colors.primary : colors.muted,
              },
            ]}
            disabled={!composerText.trim() || sending}
            onPress={onSend}
            activeOpacity={0.88}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather
                name="send"
                size={18}
                color={composerText.trim() ? "#fff" : colors.mutedForeground}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorText: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  deleteHeaderBtn: { backgroundColor: "#FEF2F2" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  scroll: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3, marginTop: 2 },
  membersCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, gap: 14, marginTop: 8 },
  membersRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  memberChip: { alignItems: "center", gap: 6, width: 64 },
  memberAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  memberInitials: { fontSize: 14, fontFamily: "Inter_700Bold" },
  memberName: { fontSize: 12, fontFamily: "Inter_500Medium", maxWidth: 60 },
  driverTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  driverTagText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  pickupHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 },
  optimizedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  optimizedText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  voteStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  voteStatusText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  lockedCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  lockedIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  lockedTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  lockedSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 2 },
  pickupCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 0,
    borderColor: "transparent",
  },
  pickupTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickupTopBadges: { flexDirection: "row", gap: 6 },
  brandBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  brandBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  bestBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  bestBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  voteCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  voteCountText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  pickupName: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  pickupAddr: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  metric: { flex: 1, alignItems: "center", gap: 3 },
  metricSep: { width: 1, height: 32 },
  metricLabel: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },
  metricValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  approveBtn: {
    height: 44,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  approveBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  activityHeader: { marginTop: 14 },
  systemBubble: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "center",
    maxWidth: "100%",
  },
  systemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  systemText: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },
  userBubble: { borderRadius: 16, padding: 12, gap: 4, maxWidth: "82%" },
  userBubbleMine: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  userBubbleTheirs: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  userName: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  userText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  userTime: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2, alignSelf: "flex-end" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 14 : 12,
    borderTopWidth: 1,
  },
  composerInputWrap: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 4,
    minHeight: 44,
    maxHeight: 120,
    justifyContent: "center",
  },
  composerInput: { fontSize: 14, fontFamily: "Inter_400Regular", paddingTop: 0, paddingBottom: 0 },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
