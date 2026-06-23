import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { listMyBookings, type Booking } from "@/lib/bookings";
import { deleteTrip, listMyTrips } from "@/lib/trips";
import type { Trip } from "@/data/trips";

interface TripItem {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  /** ISO timestamp used for sorting. */
  departureAt: string;
  seats: number;
  price: number;
  status: "upcoming" | "completed" | "cancelled";
  role: "driver" | "rider";
  rated?: boolean;
}

function cityShort(c: string): string {
  return c.replace(/, TX$/, "").replace(/, AR$/, "");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function bookingToItem(b: Booking): TripItem {
  const departed = new Date(b.trip.departureAt).getTime() < Date.now();
  const status: TripItem["status"] =
    b.status === "cancelled"
      ? "cancelled"
      : b.status === "completed" || departed
      ? "completed"
      : "upcoming";
  return {
    id: b.id,
    from: cityShort(b.trip.fromCity),
    to: cityShort(b.trip.toCity),
    date: formatDate(b.trip.departureAt),
    time: formatTime(b.trip.departureAt),
    departureAt: b.trip.departureAt,
    seats: b.seats,
    price: b.totalAmount,
    status,
    role: "rider",
  };
}

function tripToItem(t: Trip): TripItem {
  const departed = new Date(t.departureAt).getTime() < Date.now();
  const status: TripItem["status"] =
    t.status === "cancelled"
      ? "cancelled"
      : t.status === "completed" || departed
      ? "completed"
      : "upcoming";
  return {
    id: t.id,
    from: cityShort(t.fromCity),
    to: cityShort(t.toCity),
    date: formatDate(t.departureAt),
    time: formatTime(t.departureAt),
    departureAt: t.departureAt,
    seats: t.seatsAvailable,
    price: t.pricePerSeat,
    status,
    role: "driver",
  };
}

export default function TripsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [items, setItems] = useState<TripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDriver = user?.role === "driver";

  const load = useCallback(async () => {
    setError(null);
    try {
      // Always fetch the rider's bookings; if the user is a driver, also pull
      // their own posted trips. (The list endpoint already filters to active +
      // MVP cities; we further dedupe by driverId on the client.)
      const [bookings, myTrips] = await Promise.all([
        listMyBookings(),
        user ? listMyTrips() : Promise.resolve([] as Trip[]),
      ]);
      const merged: TripItem[] = [
        ...bookings.map(bookingToItem),
        ...myTrips.map(tripToItem),
      ];
      // Upcoming first (earliest departure first), then past (most recent first).
      merged.sort((a, b) => {
        const aUp = a.status === "upcoming";
        const bUp = b.status === "upcoming";
        if (aUp && !bUp) return -1;
        if (!aUp && bUp) return 1;
        const aT = new Date(a.departureAt).getTime();
        const bT = new Date(b.departureAt).getTime();
        return aUp ? aT - bT : bT - aT;
      });
      setItems(merged);
    } catch (err: any) {
      setError(err?.message || "Couldn't load your adventures.");
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load().finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function confirmDelete(item: TripItem) {
    Alert.alert(
      "Cancel this Adventure?",
      `Your post from ${item.from} → ${item.to} on ${item.date} will be removed from search results. Existing booking history is preserved.`,
      [
        { text: "Don't Cancel", style: "cancel" },
        {
          text: "Cancel Adventure",
          style: "destructive",
          onPress: async () => {
            // Optimistic: flip status to cancelled so it moves to "Past"
            // immediately. Restore prior status on failure.
            const prevStatus = item.status;
            setItems((curr) =>
              curr.map((x) =>
                x.id === item.id ? { ...x, status: "cancelled" } : x,
              ),
            );
            try {
              await deleteTrip(item.id);
            } catch (err: any) {
              setItems((curr) =>
                curr.map((x) =>
                  x.id === item.id ? { ...x, status: prevStatus } : x,
                ),
              );
              Alert.alert(
                "Couldn't cancel",
                err?.message || "Please try again.",
              );
            }
          },
        },
      ],
    );
  }

  const filtered = items.filter((t) =>
    tab === "upcoming" ? t.status === "upcoming" : t.status !== "upcoming",
  );

  function renderTrip({ item }: { item: TripItem }) {
    const isUpcoming = item.status === "upcoming";
    const statusConfig = {
      upcoming: { bg: "#EBF2ED", text: colors.primary, label: "Upcoming" },
      completed: { bg: colors.muted, text: colors.mutedForeground, label: "Completed" },
      cancelled: { bg: "#FEF0F0", text: colors.destructive, label: "Cancelled" },
    }[item.status];

    return (
      <TouchableOpacity
        style={[styles.card, CARD_SHADOW]}
        onPress={() =>
          isUpcoming
            ? router.push({ pathname: "/tracking/[id]", params: { id: item.id } })
            : undefined
        }
        activeOpacity={isUpcoming ? 0.88 : 1}
      >
        <View style={styles.cardTop}>
          <View style={styles.routeBlock}>
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.city, { color: colors.foreground }]}>{item.from}, TX</Text>
            </View>
            <View style={[styles.routeConnector, { borderLeftColor: colors.border }]} />
            <View style={styles.routeRow}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.city, { color: colors.foreground }]}>{item.to}, TX</Text>
            </View>
          </View>

          <View style={styles.rightBlock}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Text style={[styles.statusText, { color: statusConfig.text }]}>{statusConfig.label}</Text>
            </View>
            <Text style={[styles.price, { color: colors.primary }]}>${item.price.toFixed(0)}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Feather name="calendar" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.date}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.time}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name={item.role === "driver" ? "navigation" : "user"} size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {item.role === "driver"
                ? "Driving"
                : `${item.seats} seat${item.seats > 1 ? "s" : ""}`}
            </Text>
          </View>
          {isUpcoming && (
            <TouchableOpacity
              style={[styles.actionChip, { backgroundColor: colors.secondary }]}
              onPress={() => router.push({ pathname: "/tracking/[id]", params: { id: item.id } })}
            >
              <Feather name="map-pin" size={11} color={colors.primary} />
              <Text style={[styles.chipText, { color: colors.primary }]}>Track</Text>
            </TouchableOpacity>
          )}
          {isUpcoming && item.role === "driver" && (
            <TouchableOpacity
              style={[styles.actionChip, { backgroundColor: "#FEF0F0", marginLeft: 0 }]}
              onPress={() => confirmDelete(item)}
            >
              <Feather name="trash-2" size={11} color={colors.destructive} />
              <Text style={[styles.chipText, { color: colors.destructive }]}>Cancel</Text>
            </TouchableOpacity>
          )}
          {item.status === "completed" && !item.rated && item.role === "rider" && (
            <TouchableOpacity
              style={[styles.actionChip, { backgroundColor: "#FEF3E2" }]}
              onPress={() => router.push({ pathname: "/rate-trip/[id]", params: { id: item.id } })}
            >
              <Feather name="star" size={11} color="#C4954A" />
              <Text style={[styles.chipText, { color: "#C4954A" }]}>Rate</Text>
            </TouchableOpacity>
          )}
          {item.status === "completed" && item.rated && (
            <View style={[styles.actionChip, { backgroundColor: "#ECFDF5" }]}>
              <Feather name="check" size={11} color="#059669" />
              <Text style={[styles.chipText, { color: "#059669" }]}>Rated</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.heading, { color: colors.foreground }]}>My Adventures</Text>
          {isDriver && (
            <TouchableOpacity
              style={[styles.postBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/post-trip" as any)}
              activeOpacity={0.88}
            >
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.postBtnText}>Post Adventure</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
          {(["upcoming", "past"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && [styles.tabActive, { backgroundColor: "#fff" }]]}
              onPress={() => setTab(t)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === t ? colors.primary : colors.mutedForeground },
                  tab === t && { fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {t === "upcoming" ? "Upcoming" : "Past"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderTrip}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="map" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {error ? "Couldn't load your adventures" : "No adventures yet"}
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                {error
                  ? error
                  : isDriver
                  ? "Post your first adventure to start sharing travel costs."
                  : "Book your first adventure to get started."}
              </Text>
              <TouchableOpacity
                style={[styles.findBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push(isDriver ? ("/post-trip" as any) : "/(tabs)")}
              >
                <Text style={styles.findBtnText}>{isDriver ? "Post an Adventure" : "Find an Adventure"}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 22, paddingBottom: 16, gap: 14 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  postBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  postBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabRow: { flexDirection: "row", borderRadius: 14, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: "center" },
  tabActive: {},
  tabText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  list: { paddingHorizontal: 22, paddingTop: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    gap: 14,
  },
  cardTop: { flexDirection: "row", gap: 12 },
  routeBlock: { flex: 1, gap: 0 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  city: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  routeConnector: { marginLeft: 3, height: 14, borderLeftWidth: 2, borderStyle: "dashed" },
  rightBlock: { alignItems: "flex-end", gap: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  price: { fontSize: 20, fontFamily: "Inter_700Bold" },
  divider: { height: 1 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actionChip: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingTop: 60, gap: 14 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 24 },
  findBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 28 },
  findBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
