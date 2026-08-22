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

function Avatar({ name, size = 52 }: { name: string; size?: number }) {
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
          backgroundColor: colors.primary,
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
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
      <View style={[styles.tile, { backgroundColor: colors.muted }]}>
        <Feather name="truck" size={22} color={colors.primary} />
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
          {/* Hub state lives in the subtitle, the way the design writes it —
              as a second pill it squeezed the preview down to three characters. */}
          <Text
            style={[styles.rowSub, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {group.latestMessage ||
              (group.pickupLocked
                ? `Hub set${group.pickupHub ? ` — ${group.pickupHub.storeName}` : ""}`
                : "No messages yet")}
          </Text>
          <View style={[styles.tag, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Feather name="users" size={11} color={colors.mutedForeground} />
            <Text style={[styles.tagText, { color: colors.mutedForeground }]}>
              {group.memberCount} Sailor{group.memberCount === 1 ? "" : "s"}
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
  const [tab, setTab] = useState<"direct" | "groups">("direct");

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
            {/* Gold, as the design draws it. It reinforces an unread state the
                row already carries in the name's weight and the preview's ink,
                so it is decorative rather than the sole indicator. */}
            {item.unread && (
              <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
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

        {/* The design's segmented switch: one list at a time, not two stacked. */}
        <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
          {(["direct", "groups"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && { backgroundColor: colors.primary }]}
              onPress={() => setTab(t)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === t ? "#fff" : INK_ON_MUTED },
                  tab === t && { fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {t === "direct" ? "Direct" : "Adventure Groups"}
              </Text>
            </TouchableOpacity>
          ))}
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
        {tab === "groups" ? (
          groupsLoading ? (
            <View style={styles.listLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : filteredGroups.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="users" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {q ? "No matching groups" : "No adventure groups yet"}
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                {q
                  ? "Try a different search."
                  : "After you book a seat, your private Adventure group chat appears here."}
              </Text>
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
          )
        ) : convLoading ? (
          <View style={styles.listLoading}>
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
  header: { paddingHorizontal: 22, paddingBottom: 14, gap: 14 },
  heading: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === "ios" ? 12 : 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", paddingVertical: 7 },
  tabRow: { flexDirection: "row", borderRadius: 999, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 11, borderRadius: 999, alignItems: "center" },
  tabText: { fontSize: 14, fontFamily: "Inter_500Medium" },

  listLoading: { paddingVertical: 24, alignItems: "center" },

  // One card of divided rows, as the design draws it.
  listCard: {
    marginHorizontal: 22,
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
    minHeight: 84,
  },
  tile: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  rowBody: { flex: 1, gap: 5 },
  rowTop: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  rowTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold", letterSpacing: -0.2 },
  rowWhen: { fontSize: 13, fontFamily: "Inter_400Regular", flexShrink: 0 },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowSub: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  tagText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  unreadDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  routeTextSmall: { fontSize: 12, fontFamily: "Inter_500Medium" },

  empty: {
    alignItems: "center",
    paddingTop: 48,
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
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
