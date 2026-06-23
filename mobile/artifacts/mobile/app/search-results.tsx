import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import TripCard from "@/components/TripCard";
import { useColors } from "@/hooks/useColors";
import { listTrips } from "@/lib/trips";
import type { Trip } from "@/data/trips";

export default function SearchResults() {
  const colors = useColors();
  const router = useRouter();
  const { from, to, date } = useLocalSearchParams<{
    from: string;
    to: string;
    date: string;
    passengers: string;
  }>();
  const [filterVisible, setFilterVisible] = useState(false);
  const [maxPrice, setMaxPrice] = useState(50);
  const [sortBy, setSortBy] = useState<"price" | "rating" | "time">("price");

  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const trips = useMemo(() => {
    const filtered = allTrips.filter((t) => t.pricePerSeat <= maxPrice);
    return [...filtered].sort((a, b) => {
      if (sortBy === "price") return a.pricePerSeat - b.pricePerSeat;
      if (sortBy === "rating") return b.driver.rating - a.driver.rating;
      // "time" — soonest first
      return new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime();
    });
  }, [allTrips, maxPrice, sortBy]);

  const fromCity = from?.split(",")[0] ?? from ?? "";
  const toCity = to?.split(",")[0] ?? to ?? "";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.route, { color: colors.foreground }]}>
            {fromCity} → {toCity}
          </Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {date ? `${date} · ` : ""}
            {loading ? "Loading…" : `${trips.length} ride${trips.length !== 1 ? "s" : ""} found`}
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
        {(["price", "rating", "time"] as const).map((s) => (
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
              {s === "price" ? "Price ↑" : s === "rating" ? "Rating ↓" : "Soonest"}
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="search" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No adventures found</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                No drivers have posted this route yet. Try a different day or check back soon.
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
              Max price per seat: <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>${maxPrice}</Text>
            </Text>
            <View style={styles.priceRow}>
              {[20, 25, 30, 40, 50].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.pricePill,
                    {
                      backgroundColor: maxPrice === p ? colors.primary : colors.muted,
                      borderColor: maxPrice === p ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setMaxPrice(p)}
                >
                  <Text style={[styles.pricePillText, { color: maxPrice === p ? "#fff" : colors.mutedForeground }]}>
                    ${p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.primary }]}
              onPress={() => setFilterVisible(false)}
              activeOpacity={0.88}
            >
              <Text style={styles.applyBtnText}>Apply Filters</Text>
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
  priceRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  pricePill: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  pricePillText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  applyBtn: { height: 54, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  applyBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
