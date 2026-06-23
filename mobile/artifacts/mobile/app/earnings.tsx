import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { CARD_SHADOW } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { apiClient } from "@/lib/api";

const IRS_RATE = 0.67 * 0.75; // $0.5025/mile — IRS rate × Bovogo 0.75 factor

type Period = "month" | "all";

interface EarningsTrip {
  id: string;
  fromCity: string;
  toCity: string;
  miles: number;
  seatsBooked: number;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  completedAt: string;
}

interface EarningsData {
  period: Period;
  tripCount: number;
  totalMiles: number;
  grossTotal: number;
  platformFeeTotal: number;
  netTotal: number;
  trips: EarningsTrip[];
}

const CURRENT_MONTH_LABEL = new Date().toLocaleString("en-US", {
  month: "long",
  year: "numeric",
});

function formatTripDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric" });
}

export default function Earnings() {
  const colors = useColors();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  const load = useCallback(
    async (p: Period, isRefresh = false) => {
      const reqId = ++reqIdRef.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<EarningsData>(`/earnings?period=${p}`);
        if (reqId !== reqIdRef.current) return; // stale, ignore
        setData(res);
      } catch (e: any) {
        if (reqId !== reqIdRef.current) return;
        setError(
          typeof e?.message === "string"
            ? e.message
            : "Couldn't load earnings.",
        );
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    load(period);
  }, [load, period]);

  const showSpinner = loading && !data;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Savings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(period, true)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
          <Feather name="info" size={14} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.primary }]}>
            Bovogo is a cost-sharing platform. You save on actual travel expenses — not profit. IRS rate: $0.67/mile.
          </Text>
        </View>

        <View style={styles.periodRow}>
          {(["month", "all"] as const).map((p) => {
            const active = p === period;
            return (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriod(p)}
                style={[
                  styles.periodChip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.periodChipText,
                    { color: active ? "#fff" : colors.foreground },
                  ]}
                >
                  {p === "month" ? "This Month" : "All Time"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {showSpinner ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={[styles.errorCard, CARD_SHADOW]}>
            <Feather name="alert-circle" size={18} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.foreground }]}>{error}</Text>
            <TouchableOpacity
              onPress={() => load(period)}
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
            >
              <Text style={styles.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : data ? (
          <>
            <View style={[styles.summaryCard, CARD_SHADOW]}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                Net Savings ({period === "month" ? CURRENT_MONTH_LABEL : "All Time"})
              </Text>
              <Text style={[styles.summaryAmount, { color: colors.foreground }]}>
                ${data.netTotal.toFixed(2)}
              </Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <View style={styles.summaryStat}>
                  <Text style={[styles.statNum, { color: colors.foreground }]}>{data.tripCount}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Adventures</Text>
                </View>
                <View style={[styles.statSep, { backgroundColor: colors.border }]} />
                <View style={styles.summaryStat}>
                  <Text style={[styles.statNum, { color: colors.foreground }]}>{data.totalMiles}</Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Miles</Text>
                </View>
                <View style={[styles.statSep, { backgroundColor: colors.border }]} />
                <View style={styles.summaryStat}>
                  <Text style={[styles.statNum, { color: colors.foreground }]}>
                    ${data.grossTotal.toFixed(0)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Gross</Text>
                </View>
              </View>
            </View>

            <View style={[styles.breakdownCard, CARD_SHADOW]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Cost Breakdown</Text>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>
                  Rider payments collected
                </Text>
                <Text style={[styles.breakdownValue, { color: colors.foreground }]}>
                  ${data.grossTotal.toFixed(2)}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, { color: colors.mutedForeground }]}>
                  Bovogo service fee
                </Text>
                <Text style={[styles.breakdownValue, { color: colors.destructive }]}>
                  −${data.platformFeeTotal.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownBold, { color: colors.foreground }]}>Net savings</Text>
                <Text style={[styles.breakdownBold, { color: colors.primary }]}>
                  ${data.netTotal.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.irsNote, { backgroundColor: colors.muted }]}>
                <Feather name="file-text" size={12} color={colors.mutedForeground} />
                <Text style={[styles.irsNoteText, { color: colors.mutedForeground }]}>
                  IRS 1099-K required if annual savings exceed $600. Keep records of all trips.
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12 }]}>
              Trip History
            </Text>

            {data.trips.length === 0 ? (
              <View style={[styles.emptyCard, CARD_SHADOW]}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="navigation" size={22} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  No completed trips yet
                </Text>
                <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                  Once you complete a trip with riders, your cost-recovery and IRS records will show up here automatically.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/post-trip")}
                  style={[styles.emptyCta, { backgroundColor: colors.primary }]}
                  activeOpacity={0.88}
                >
                  <Text style={styles.emptyCtaText}>Post a trip</Text>
                </TouchableOpacity>
              </View>
            ) : (
              data.trips.map((trip) => {
                const irsCost = (trip.miles * IRS_RATE).toFixed(2);
                return (
                  <View key={trip.id} style={[styles.tripCard, CARD_SHADOW]}>
                    <View style={styles.tripTop}>
                      <View style={styles.tripRoute}>
                        <Text style={[styles.tripCity, { color: colors.foreground }]}>
                          {trip.fromCity} → {trip.toCity}
                        </Text>
                        <Text style={[styles.tripDate, { color: colors.mutedForeground }]}>
                          {formatTripDate(trip.completedAt)} · {trip.miles} miles
                        </Text>
                      </View>
                      <View style={styles.tripRight}>
                        <Text style={[styles.tripTotal, { color: colors.primary }]}>
                          ${trip.netAmount.toFixed(2)}
                        </Text>
                        <Text style={[styles.tripSeats, { color: colors.mutedForeground }]}>
                          {trip.seatsBooked} seat{trip.seatsBooked > 1 ? "s" : ""}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.tripIrs, { backgroundColor: colors.muted }]}>
                      <Feather name="navigation" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.tripIrsText, { color: colors.mutedForeground }]}>
                        IRS cost ({trip.miles} mi × $0.67) = ${irsCost} — within recovery limit
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 14, borderRadius: 14 },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  periodRow: { flexDirection: "row", gap: 10 },
  periodChip: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  periodChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  loadingBox: { paddingVertical: 60, alignItems: "center" },
  errorCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    gap: 12,
  },
  errorText: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },
  retryBtn: { paddingHorizontal: 18, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  retryBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  summaryCard: { backgroundColor: "#fff", borderRadius: 20, padding: 22, gap: 16 },
  summaryLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  summaryAmount: { fontSize: 42, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  divider: { height: 1 },
  summaryRow: { flexDirection: "row", justifyContent: "space-around" },
  summaryStat: { alignItems: "center", gap: 4 },
  statNum: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statSep: { width: 1, height: 32 },
  breakdownCard: { backgroundColor: "#fff", borderRadius: 18, padding: 18, gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", letterSpacing: -0.2 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  breakdownLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  breakdownValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  breakdownBold: { fontSize: 15, fontFamily: "Inter_700Bold" },
  irsNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10 },
  irsNoteText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  emptyBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    textAlign: "center",
  },
  emptyCta: {
    marginTop: 8,
    paddingHorizontal: 24,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCtaText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tripCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 10 },
  tripTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  tripRoute: { flex: 1, gap: 4 },
  tripCity: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tripDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tripRight: { alignItems: "flex-end", gap: 2 },
  tripTotal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  tripSeats: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tripIrs: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 8, borderRadius: 10 },
  tripIrsText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});
