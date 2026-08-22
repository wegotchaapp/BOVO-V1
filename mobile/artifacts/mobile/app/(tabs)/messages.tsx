import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW, INK_ON_MUTED } from "@/constants/colors";
import {
  listMyConversations,
  type Conversation,
} from "@/lib/conversations";
import { listMyGroups, type TripGroupSummary } from "@/lib/groups";

function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const colors = useColors();
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.secondary,
        },
      ]}
    >
      <Text
        style={[
          styles.avatarText,
          { color: colors.primary, fontSize: size * 0.34 },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

function cityShort(c: string): string {
  return c.replace(/, TX$/, "").replace(/, AR$/, "");
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function GroupRow({
  group,
  last,
  onPress,
}: {
  group: TripGroupSummary;
  last: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.tile, { backgroundColor: colors.secondary }]}>
        <Feather name="truck" size={20} color={colors.primary} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
            {cityShort(group.fromCity)} → {cityShort(group.toCity)}
          </Text>
          {/* The departure is its own element rather than the tail of the
              route string, so a long route can never truncate the date away. */}
          <Text style={[styles.rowWhen, { color: colors.mutedForeground }]}>
            {formatDay(group.departureAt)}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.rowSub, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {group.latestMessage || "No messages yet"}
          </Text>
          {group.pickupLocked && (
            <View style={[styles.tag, { backgroundColor: colors.secondary }]}>
              <Feather name="check-circle" size={10} color={colors.primary} />
              <Text style={[styles.tagText, { color: colors.primary }]}>Hub set</Text>
            </View>
          )}
          <View style={[styles.tag, { backgroundColor: colors.muted }]}>
            <Feather name="users" size={10} color={INK_ON_MUTED} />
            <Text style={[styles.tagText, { color: INK_ON_MUTED }]}>
              {group.memberCount}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MessagesTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [groups, setGroups] = useState<TripGroupSummary[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [convLoading, setConvLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const loadAll = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setGroupsLoading(true);
      setConvLoading(true);
    }
    const [gRes, cRes] = await Promise.allSettled([
      listMyGroups(),
      listMyConversations(),
    ]);
    if (gRes.status === "fulfilled") setGroups(gRes.value);
    if (cRes.status === "fulfilled") setConversations(cRes.value);
    if (!opts?.silent) {
      setGroupsLoading(false);
      setConvLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setGroupsLoading(true);
      setConvLoading(true);
      Promise.allSettled([listMyGroups(), listMyConversations()]).then(
        ([gRes, cRes]) => {
          if (cancelled) return;
          if (gRes.status === "fulfilled") setGroups(gRes.value);
          if (cRes.status === "fulfilled") setConversations(cRes.value);
          setGroupsLoading(false);
          setConvLoading(false);
        },
      );
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadAll({ silent: true });
    setRefreshing(false);
  }

  const q = query.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!q) return groups;
    return groups.filter((g) => {
      const route = `${g.fromCity} ${g.toCity}`.toLowerCase();
      const latest = (g.latestMessage ?? "").toLowerCase();
      return route.includes(q) || latest.includes(q);
    });
  }, [groups, q]);

  const filteredConversations = useMemo(() => {
    if (!q) return conversations;
    return conversations.filter((c) => {
      return (
        c.userName.toLowerCase().includes(q) ||
        (c.lastMessage ?? "").toLowerCase().includes(q) ||
        (c.tripRoute ?? "").toLowerCase().includes(q)
      );
    });
  }, [conversations, q]);

  function renderConversation(item: Conversation, last: boolean) {
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
        onPress={() =>
          router.push({ pathname: "/chat/[id]", params: { id: item.id } })
        }
        activeOpacity={0.75}
      >
        <Avatar name={item.userName} />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text
              style={[
                styles.rowTitle,
                { color: colors.foreground },
                item.unread && { fontFamily: "Inter_700Bold" },
              ]}
              numberOfLines={1}
            >
              {item.userName}
            </Text>
            <Text style={[styles.rowWhen, { color: colors.mutedForeground }]}>
              {item.time}
            </Text>
          </View>
          {item.tripRoute ? (
            <View style={styles.routeRow}>
              <Feather name="map-pin" size={10} color={colors.primary} />
              <Text style={[styles.routeTextSmall, { color: colors.primary }]}>
                {item.tripRoute}
              </Text>
            </View>
          ) : null}
          <View style={styles.rowBottom}>
            <Text
              style={[
                styles.rowSub,
                { color: item.unread ? colors.foreground : colors.mutedForeground },
                item.unread && { fontFamily: "Inter_500Medium" },
              ]}
              numberOfLines={1}
            >
              {item.lastMessage || "No messages yet"}
            </Text>
            {/* The design puts a gold dot here; gold is 2.71:1 on white, which
                is under the 3:1 an indicator needs, so it stays forest. */}
            {item.unread && (
              <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
            )}
          </View>
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
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search conversations"
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {query.length > 0 && Platform.OS !== "ios" ? (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Adventure Groups
          </Text>
        </View>

        {groupsLoading ? (
          <View style={styles.groupsLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : filteredGroups.length === 0 ? (
          <View style={[styles.emptyGroups, { backgroundColor: colors.muted }]}>
            <Feather name="users" size={20} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.emptyGroupsTitle, { color: colors.foreground }]}>
                {q ? "No matching groups" : "No adventure groups yet"}
              </Text>
              <Text style={[styles.emptyGroupsSub, { color: colors.mutedForeground }]}>
                {q
                  ? "Try a different search."
                  : "After you book a seat, your private Adventure group chat appears here."}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.listCard, CARD_SHADOW]}>
            {filteredGroups.map((g, i) => (
              <GroupRow
                key={g.id}
                group={g}
                last={i === filteredGroups.length - 1}
                onPress={() =>
                  router.push({ pathname: "/group/[id]", params: { id: g.id } })
                }
              />
            ))}
          </View>
        )}

        <View style={[styles.sectionHeader, { marginTop: 18 }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Direct messages
          </Text>
        </View>

        {convLoading ? (
          <View style={styles.groupsLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="message-circle" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {q ? "No matching messages" : "No messages yet"}
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {q
                ? "Try a different name or keyword."
                : "When you book an adventure, a chat with your Voyager appears here."}
            </Text>
          </View>
        ) : (
          <View style={[styles.listCard, CARD_SHADOW]}>
            {filteredConversations.map((c, i) =>
              renderConversation(c, i === filteredConversations.length - 1),
            )}
          </View>
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
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 4,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 6 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
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
  emptyGroupsSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 17,
  },

  // Both lists are one card of divided rows, as the design has them.
  listCard: {
    marginHorizontal: 22,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    minHeight: 76,
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Inter_700Bold" },
  rowBody: { flex: 1, gap: 4 },
  rowTop: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  rowTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rowWhen: { fontSize: 12, fontFamily: "Inter_400Regular", flexShrink: 0 },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowSub: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 0,
  },
  tagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  unreadDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeTextSmall: { fontSize: 11, fontFamily: "Inter_500Medium" },

  empty: {
    alignItems: "center",
    paddingTop: 40,
    gap: 14,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
