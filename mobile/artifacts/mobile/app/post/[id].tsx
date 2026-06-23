import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  formatTimeAgo,
  formatTripDate,
  formatTripTime,
  type Trip,
  type TripReply,
} from "@/data/trips";
import { getTrip, replyToTrip } from "@/lib/trips";
import { useAuth } from "@/context/AuthContext";
import { useUnread } from "@/context/UnreadContext";
import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";

function Avatar({ name, size = 44, isDriver = false }: { name: string; size?: number; isDriver?: boolean }) {
  const colors = useColors();
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isDriver ? colors.secondary : colors.muted,
        },
      ]}
    >
      <Text style={[styles.avatarText, { color: isDriver ? colors.primary : colors.mutedForeground, fontSize: size * 0.34 }]}>
        {initials}
      </Text>
    </View>
  );
}

export default function PostDetail() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { markTripRead } = useUnread();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [post, setPost] = useState<Trip | null>(null);
  const [replies, setReplies] = useState<TripReply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Silent background refresh — keeps replies in sync without a loading flash.
  const silentRefresh = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getTrip(id);
      setPost(data.trip);
      setReplies(data.replies);
    } catch {
      // Ignore poll errors silently.
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTrip(id)
      .then((data) => {
        if (cancelled) return;
        setPost(data.trip);
        setReplies(data.replies);
        // Mark replies as read when the user opens the post.
        markTripRead(id);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? "Couldn't load post");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Poll every 8 seconds to pick up new replies from other users.
    pollRef.current = setInterval(silentRefresh, 8000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id, markTripRead, silentRefresh]);

  async function sendReply() {
    if (!post || !replyText.trim() || sending) return;
    setSending(true);
    try {
      const reply = await replyToTrip(post.id, replyText.trim());
      setReplies((prev) => [...prev, reply]);
      setReplyText("");
    } catch (err) {
      Alert.alert("Couldn't send reply", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSending(false);
    }
  }

  function handleBook() {
    if (!post) return;
    router.push({
      pathname: "/payment",
      params: { tripId: post.id },
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={[styles.safe, styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Post unavailable</Text>
        <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>{error ?? "Couldn't find this post."}</Text>
        <TouchableOpacity style={[styles.backCta, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.backCtaText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const prefIcons = [
    { icon: "wind", label: "Non-smoking", active: !post.preferences.smoking },
    { icon: "music", label: "Music", active: post.preferences.music },
    { icon: "thermometer", label: "AC", active: post.preferences.ac },
    { icon: "heart", label: "Pets OK", active: post.preferences.pets },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Voyager Post</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Feather name="share-2" size={18} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.postCard, CARD_SHADOW]}>
            <View style={styles.driverRow}>
              <Avatar name={post.driver.name} size={48} isDriver />
              <View style={styles.driverInfo}>
                <View style={styles.driverNameRow}>
                  <Text style={[styles.driverName, { color: colors.foreground }]}>{post.driver.name}</Text>
                  {post.driver.isTopDriver && (
                    <View style={[styles.topBadge, { backgroundColor: "#FEF3E2" }]}>
                      <Feather name="award" size={10} color="#C4954A" />
                      <Text style={[styles.topBadgeText, { color: "#C4954A" }]}>Top Voyager</Text>
                    </View>
                  )}
                </View>
                <View style={styles.ratingRow}>
                  <Feather name="star" size={11} color="#C4954A" />
                  <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
                    {post.driver.rating.toFixed(1)} · {post.driver.trips} trip{post.driver.trips !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
              <Text style={[styles.postedAt, { color: colors.mutedForeground }]}>{formatTimeAgo(post.createdAt)}</Text>
            </View>

            <View style={styles.routeBlock}>
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <View>
                  <Text style={[styles.cityLabel, { color: colors.foreground }]}>{post.fromCity}</Text>
                  <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>
                    {formatTripTime(post.departureAt)} · Departure
                  </Text>
                </View>
              </View>
              <View style={[styles.routeLine, { borderLeftColor: colors.border }]} />
              <View style={styles.routeRow}>
                <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.cityLabel, { color: colors.foreground }]}>{post.toCity}</Text>
              </View>
            </View>

            <View style={[styles.metaRow, { backgroundColor: colors.muted, borderRadius: 14 }]}>
              <View style={styles.metaItem}>
                <Feather name="calendar" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>{formatTripDate(post.departureAt)}</Text>
              </View>
              <View style={[styles.metaSep, { backgroundColor: colors.border }]} />
              <View style={styles.metaItem}>
                <Feather name="users" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  {post.seatsAvailable} seat{post.seatsAvailable !== 1 ? "s" : ""} left
                </Text>
              </View>
              <View style={[styles.metaSep, { backgroundColor: colors.border }]} />
              <View style={styles.metaItem}>
                <Feather name="briefcase" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>
                  {post.luggageSpace} bag{post.luggageSpace !== 1 ? "s" : ""}
                </Text>
              </View>
              <View style={[styles.metaSep, { backgroundColor: colors.border }]} />
              <View style={styles.metaItem}>
                <Text style={[styles.priceText, { color: colors.primary }]}>${post.pricePerSeat}</Text>
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>/seat</Text>
              </View>
            </View>

            {post.note ? <Text style={[styles.note, { color: colors.foreground }]}>{post.note}</Text> : null}

            <View style={styles.prefRow}>
              {prefIcons.map((p) => (
                <View
                  key={p.label}
                  style={[
                    styles.prefChip,
                    {
                      backgroundColor: p.active ? colors.secondary : colors.muted,
                      borderColor: p.active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather name={p.icon as any} size={11} color={p.active ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.prefText, { color: p.active ? colors.primary : colors.mutedForeground }]}>
                    {p.label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={[styles.refundNotice, { backgroundColor: "#FFF8EC", borderColor: "#F0C97A" }]}>
              <Feather name="info" size={14} color="#C4954A" style={{ marginTop: 1 }} />
              <Text style={[styles.refundNoticeText, { color: "#7A5A1E" }]}>
                <Text style={{ fontFamily: "Inter_600SemiBold" }}>Refund Policy: </Text>
                Full refund available only if the Adventure is cancelled by the Voyager or Sailor at least{" "}
                <Text style={{ fontFamily: "Inter_600SemiBold" }}>6 hours before</Text> the scheduled start time.
                Cancellations after that window are non-refundable.
              </Text>
            </View>
          </View>

          <View style={styles.repliesSection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Replies{" "}
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                ({replies.length})
              </Text>
            </Text>

            {replies.length === 0 && (
              <View style={[styles.emptyReplies, { backgroundColor: colors.muted }]}>
                <Feather name="message-circle" size={22} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Be the first to reply!
                </Text>
              </View>
            )}

            {replies.map((reply) => {
              const isOwnPost = !!user && user.id === post.driver.id;
              const canMessage = isOwnPost && !reply.isDriverReply;
              return (
                <View
                  key={reply.id}
                  style={[styles.replyCard, CARD_SHADOW, reply.isDriverReply && { borderLeftWidth: 3, borderLeftColor: colors.primary }]}
                >
                  <View style={styles.replyHeader}>
                    <Avatar name={reply.userName} size={36} isDriver={reply.isDriverReply} />
                    <View style={styles.replyMeta}>
                      <View style={styles.replyNameRow}>
                        <Text style={[styles.replyName, { color: colors.foreground }]}>{reply.userName}</Text>
                        {reply.isDriverReply && (
                          <View style={[styles.driverTag, { backgroundColor: colors.secondary }]}>
                            <Text style={[styles.driverTagText, { color: colors.primary }]}>Voyager</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.replyTime, { color: colors.mutedForeground }]}>{formatTimeAgo(reply.createdAt)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.replyText, { color: colors.foreground }]}>{reply.text}</Text>
                  {canMessage && (
                    <TouchableOpacity
                      style={[styles.messageBtn, { backgroundColor: colors.secondary, borderColor: colors.primary }]}
                      onPress={() =>
                        router.push({
                          pathname: "/chat/[id]",
                          params: { id: "c1", riderId: reply.userId, riderName: reply.userName, tripId: post.id },
                        })
                      }
                      activeOpacity={0.85}
                    >
                      <Feather name="message-circle" size={14} color={colors.primary} />
                      <Text style={[styles.messageBtnText, { color: colors.primary }]}>
                        Message {reply.userName.split(" ")[0]}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>

        <>
          <View style={[styles.inputBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
            {user && user.id === post.driver.id && (
              <View style={[styles.voyagerHint, { backgroundColor: colors.secondary }]}>
                <Feather name="navigation" size={12} color={colors.primary} />
                <Text style={[styles.voyagerHintText, { color: colors.primary }]}>Replying as Voyager — visible to all</Text>
              </View>
            )}
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder={user && user.id === post.driver.id ? "Reply to your riders..." : "Ask about seats, timing, preferences..."}
                placeholderTextColor={colors.mutedForeground}
                value={replyText}
                onChangeText={setReplyText}
                multiline
                maxLength={300}
                editable={!sending}
              />
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: replyText.trim() && !sending ? colors.primary : colors.muted }]}
                onPress={sendReply}
                disabled={!replyText.trim() || sending}
              >
                <Feather name="send" size={16} color={replyText.trim() && !sending ? "#fff" : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
          {user && user.id !== post.driver.id && (
            <View style={[styles.bookBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <View>
                <Text style={[styles.bookPrice, { color: colors.primary }]}>${post.pricePerSeat}</Text>
                <Text style={[styles.bookLabel, { color: colors.mutedForeground }]}>per seat</Text>
              </View>
              <TouchableOpacity
                style={[styles.bookBtn, { backgroundColor: colors.primary }]}
                onPress={handleBook}
                activeOpacity={0.88}
              >
                <Feather name="plus-circle" size={16} color="#fff" />
                <Text style={styles.bookBtnText}>Add as My Adventure</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
  errorTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  errorSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  backCta: { marginTop: 12, paddingHorizontal: 24, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  backCtaText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  scroll: { paddingHorizontal: 20, paddingBottom: 140 },
  postCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 20, gap: 16 },
  driverRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Inter_700Bold" },
  driverInfo: { flex: 1, gap: 4 },
  driverNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  driverName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  topBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  topBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  ratingText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  postedAt: { fontSize: 12, fontFamily: "Inter_400Regular" },
  routeBlock: { gap: 0 },
  routeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  cityLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  timeLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  routeLine: { height: 16, borderLeftWidth: 2, borderStyle: "dashed", marginLeft: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", padding: 12, gap: 0 },
  metaItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  metaSep: { width: 1, height: 20 },
  metaText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  priceText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  note: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  prefRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  prefChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  prefText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  repliesSection: { gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", letterSpacing: -0.2 },
  emptyReplies: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderRadius: 14, justifyContent: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  replyCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, gap: 10 },
  replyHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  replyMeta: { flex: 1, gap: 2 },
  replyNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  replyName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  driverTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  driverTagText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  replyTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  replyText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  messageBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 2,
  },
  messageBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  voyagerHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 8,
    alignSelf: "flex-start",
  },
  voyagerHintText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  inputBar: { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  inputWrap: { flexDirection: "row", alignItems: "flex-end", borderRadius: 22, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 8, gap: 10 },
  input: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", maxHeight: 80, paddingTop: 4 },
  sendBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  bookBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, paddingBottom: Platform.OS === "ios" ? 28 : 14, borderTopWidth: 1 },
  bookPrice: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  bookLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  bookBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 22, height: 50, borderRadius: 25 },
  bookBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  refundNotice: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 12, borderRadius: 14, borderWidth: 1 },
  refundNoticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
