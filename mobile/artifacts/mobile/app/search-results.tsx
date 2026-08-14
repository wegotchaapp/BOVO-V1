import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import TripCard from "@/components/TripCard";
import { useColors } from "@/hooks/useColors";
import { listTrips } from "@/lib/trips";
import { formatUsd, SEAT_PRICE } from "@/lib/pricing";
import { EMPTY_SEARCH_RESULTS, pickLine } from "@/constants/voice";
import type { Trip } from "@/data/trips";

export default function SearchResults() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    from: string;
    to: string;
    fromArea: string;
    toArea: string;
    date: string;
    passengers: string;
    luggage: string;
  }>();
  const { from, to, date } = params;
  const fromArea = params.fromArea ?? "";
  const toArea = params.toArea ?? "";
  // Seats/bags requested on the search card become hard capacity filters.
  const passengers = Math.max(1, Number(params.passengers) || 1);
  const luggage = Math.max(0, Number(params.luggage) || 0);

  const [filterVisible, setFilterVisible] = useState(false);
  // Every seat is a flat $32.40, so price is a sort/filter no-op — capacity and
  // departure time are what actually differentiate adventures.
  const [sortBy, setSortBy] = useState<"rating" | "time" | "seats">("time");

  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTrips(opts?: { silent?: boolean }) {
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const rows = await listTrips({ from, to });
      setAllTrips(rows);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't load adventures");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listTrips({ from, to })
      .then((rows) => {
        if (!cancelled) setAllTrips(rows);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? "Couldn't load adventures");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  async function onRefresh() {
    setRefreshing(true);
    await loadTrips({ silent: true });
    setRefreshing(false);
  }

  const trips = useMemo(() => {
    const filtered = allTrips.filter(
      (t) => t.seatsAvailable >= passengers && t.luggageSpace >= luggage,
    );
    return [...filtered].sort((a, b) => {
      if (sortBy === "rating") return b.driver.rating - a.driver.rating;
      if (sortBy === "seats") return b.seatsAvailable - a.seatsAvailable;
      // "time" — soonest first
      return new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime();
    });
  }, [allTrips, passengers, luggage, sortBy]);

  const fromCity = from?.split(",")[0] ?? from ?? "";
  const toCity = to?.split(",")[0] ?? to ?? "";

  /** "Tue, Mar 3 · 2 passengers · 1 bag" — what the Sailor actually asked for. */
  const criteria = [
    date,
    `${passengers} passenger${passengers === 1 ? "" : "s"}`,
    luggage > 0 ? `${luggage} bag${luggage === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const emptyVoice = useMemo(
    () => pickLine(EMPTY_SEARCH_RESULTS, `${from}-${to}`),
    [from, to],
  );

  const routeLabel =
    `${fromCity}${fromArea ? ` (${fromArea})` : ""} → ${toCity}${toArea ? ` (${toArea})` : ""}`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.route, { color: colors.foreground }]} numberOfLines={1}>
            {routeLabel}
          </Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {criteria ? `${criteria} · ` : ""}
            {loading
              ? "Loading…"
              : `${trips.length} adventure${trips.length !== 1 ? "s" : ""} found`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, { backgroundColor: colors.secondary }]}
          onPress={() => setFilterVisible(true)}
        >
          <Feather name="sliders" size={15} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.sortRow}>
        {(["time", "rating", "seats"] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.sortChip,
              {
                backgroundColor: sortBy === s ? colors.primary : colors.card,
                borderColor: sortBy === s ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setSortBy(s)}
          >
            <Text
              style={[
                styles.sortText,
                { color: sortBy === s ? "#fff" : colors.mutedForeground },
              ]}
            >
              {s === "time" ? "Soonest" : s === "rating" ? "Rating ↓" : "Most seats"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="alert-circle" size={28} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Couldn't load adventures</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => <TripCard trip={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="search" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{emptyVoice.title}</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                {allTrips.length > 0
                  ? `No Voyager on this route has room for ${passengers} passenger${
                      passengers === 1 ? "" : "s"
                    }${luggage > 0 ? ` and ${luggage} bag${luggage === 1 ? "" : "s"}` : ""}. Try fewer seats or another day.`
                  : emptyVoice.body}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={filterVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Filter Adventures</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>
              Every seat is a flat{" "}
              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>
                {formatUsd(SEAT_PRICE)}
              </Text>
              , so results are filtered by capacity rather than price.
            </Text>

            <View style={styles.criteriaRow}>
              <View style={[styles.criteriaChip, { backgroundColor: colors.secondary }]}>
                <Feather name="users" size={13} color={colors.primary} />
                <Text style={[styles.criteriaText, { color: colors.primary }]}>
                  {passengers} passenger{passengers === 1 ? "" : "s"}
                </Text>
              </View>
              <View style={[styles.criteriaChip, { backgroundColor: colors.secondary }]}>
                <Feather name="briefcase" size={13} color={colors.primary} />
                <Text style={[styles.criteriaText, { color: colors.primary }]}>
                  {luggage} bag{luggage === 1 ? "" : "s"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.muted }]}
              onPress={() => {
                setFilterVisible(false);
                router.back();
              }}
              activeOpacity={0.88}
            >
              <Text style={[styles.applyBtnText, { color: colors.foreground }]}>
                Change passengers or bags
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.primary }]}
              onPress={() => setFilterVisible(false)}
              activeOpacity={0.88}
            >
              <Text style={styles.applyBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    gap: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  route: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  filterBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  sortRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  sortChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  sortText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { alignItems: "center", paddingTop: 60, gap: 14, paddingHorizontal: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingTop: 12, gap: 20 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E3DDD3", alignSelf: "center", marginBottom: 8 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  filterLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  criteriaRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  criteriaChip: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  criteriaText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  applyBtn: { height: 54, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  applyBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
