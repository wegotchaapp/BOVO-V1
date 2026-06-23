import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";
import { MOCK_CONVERSATIONS, type Conversation } from "@/data/messages";
import { listMyGroups, type TripGroupSummary } from "@/lib/groups";

function Avatar({ name, size = 50 }: { name: string; size?: number }) {
  const colors = useColors();
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.secondary },
      ]}
    >
      <Text style={[styles.avatarText, { color: colors.primary, fontSize: size * 0.34 }]}>
        {initials}
      </Text>
    </View>
  );
}

function cityShort(c: string): string {
  return c.replace(/, TX$/, "").replace(/, AR$/, "");
}

function GroupCard({
  group,
  onPress,
}: {
  group: TripGroupSummary;
  onPress: () => void;
}) {
  const colors = useColors();
  // Avatar stack: 3 colored circles is plenty of signal without n-queries.
  const avatarColors = [colors.primary, colors.accent, "#1A7A4A"];
  return (
    <TouchableOpacity
      style={[styles.groupCard, CARD_SHADOW]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.groupTop}>
        <View style={styles.routePill}>
          <Feather name="map-pin" size={11} color={colors.primary} />
          <Text style={[styles.routeText, { color: colors.primary }]} numberOfLines={1}>
            {cityShort(group.fromCity)} → {cityShort(group.toCity)}
          </Text>
        </View>
        {group.pickupLocked && (
          <View style={[styles.lockedPill, { backgroundColor: "#EBF2ED" }]}>
            <Feather name="check-circle" size={10} color={colors.primary} />
            <Text style={[styles.lockedPillText, { color: colors.primary }]}>Hub set</Text>
          </View>
        )}
      </View>
      <Text style={[styles.groupLatest, { color: colors.foreground }]} numberOfLines={2}>
        {group.latestMessage || "Pickup planning discussion..."}
      </Text>
      <View style={styles.groupBottom}>
        <View style={styles.avatarStack}>
          {avatarColors.slice(0, Math.min(3, group.memberCount)).map((c, i) => (
            <View
              key={i}
              style={[
                styles.stackAvatar,
                {
                  backgroundColor: c,
                  marginLeft: i === 0 ? 0 : -10,
                  zIndex: 3 - i,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.memberCount, { color: colors.mutedForeground }]}>
          {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
        </Text>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
      </View>
    </TouchableOpacity>
  );
}

export default function MessagesTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [groups, setGroups] = useState<TripGroupSummary[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setGroupsLoading(true);
      listMyGroups()
        .then((g) => {
          if (!cancelled) setGroups(g);
        })
        .catch(() => {
          // Silent — Adventure Groups section just stays empty. Direct messages
          // section below is unaffected.
        })
        .finally(() => {
          if (!cancelled) setGroupsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  function renderConversation(item: Conversation) {
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.item, { borderBottomColor: colors.border }]}
        onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id } })}
        activeOpacity={0.75}
      >
        <View style={styles.avatarWrap}>
          <Avatar name={item.userName} />
          {item.unread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
        </View>
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text
              style={[
                styles.name,
                { color: colors.foreground },
                item.unread && { fontFamily: "Inter_700Bold" },
              ]}
            >
              {item.userName}
            </Text>
            <Text style={[styles.time, { color: colors.mutedForeground }]}>{item.time}</Text>
          </View>
          {item.tripRoute && (
            <View style={styles.routeRow}>
              <Feather name="map-pin" size={10} color={colors.primary} />
              <Text style={[styles.routeTextSmall, { color: colors.primary }]}>{item.tripRoute}</Text>
            </View>
          )}
          <Text
            style={[
              styles.lastMsg,
              { color: item.unread ? colors.foreground : colors.mutedForeground },
              item.unread && { fontFamily: "Inter_500Medium" },
            ]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) },
        ]}
      >
        <Text style={[styles.heading, { color: colors.foreground }]}>Messages</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <Text style={[styles.searchPlaceholder, { color: colors.mutedForeground }]}>
            Search conversations
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Adventure Groups ──────────────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Adventure Groups</Text>
          <View style={[styles.newBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.newBadgeText, { color: colors.primary }]}>NEW</Text>
          </View>
        </View>

        {groupsLoading ? (
          <View style={styles.groupsLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : groups.length === 0 ? (
          <View style={[styles.emptyGroups, { backgroundColor: colors.muted }]}>
            <Feather name="users" size={20} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.emptyGroupsTitle, { color: colors.foreground }]}>
                No trip groups yet
              </Text>
              <Text style={[styles.emptyGroupsSub, { color: colors.mutedForeground }]}>
                When all seats on a trip are booked, your group chat appears here.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.groupsList}>
            {groups.map((g) => (
              <GroupCard
                key={g.id}
                group={g}
                onPress={() => router.push({ pathname: "/group/[id]", params: { id: g.id } })}
              />
            ))}
          </View>
        )}

        {/* ── Direct messages ──────────────────────────────────────────────── */}
        <View style={[styles.sectionHeader, { marginTop: 18 }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Direct messages</Text>
        </View>

        {MOCK_CONVERSATIONS.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="message-circle" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No messages yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Messages with drivers and riders will appear here
            </Text>
          </View>
        ) : (
          MOCK_CONVERSATIONS.map(renderConversation)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 22, paddingBottom: 12, gap: 14 },
  heading: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  searchPlaceholder: { fontSize: 14, fontFamily: "Inter_400Regular" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  newBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  newBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  groupsLoading: { paddingVertical: 20, alignItems: "center" },
  emptyGroups: {
    marginHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
  },
  emptyGroupsTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyGroupsSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 },
  groupsList: { paddingHorizontal: 22, gap: 10 },
  groupCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  groupTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  routePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#EBF2ED",
    flex: 1,
  },
  routeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  lockedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  lockedPillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  groupLatest: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  groupBottom: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarStack: { flexDirection: "row" },
  stackAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#fff",
  },
  memberCount: { fontSize: 11, fontFamily: "Inter_500Medium" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
  },
  avatarWrap: { position: "relative" },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Inter_700Bold" },
  unreadDot: {
    position: "absolute",
    top: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  content: { flex: 1, gap: 4 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 15, fontFamily: "Inter_500Medium" },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeTextSmall: { fontSize: 11, fontFamily: "Inter_500Medium" },
  lastMsg: { fontSize: 13, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingTop: 40, gap: 14, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
