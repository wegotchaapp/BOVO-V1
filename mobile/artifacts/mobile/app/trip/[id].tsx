import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { DriverAvatar } from "@/components/TripCard";
import {
  approximateArrivalTime,
  formatTripTime,
  type Trip,
} from "@/data/trips";
import { getTrip } from "@/lib/trips";
import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";

export default function TripDetails() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTrip(id)
      .then((data) => {
        if (!cancelled) setTrip(data.trip);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? "Couldn't load trip");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function handleRequest() {
    if (!trip) return;
    router.push({ pathname: "/payment", params: { tripId: trip.id } });
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !trip) {
    return (
      <SafeAreaView style={[styles.safe, styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Adventure unavailable</Text>
        <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>
          {error ?? "We couldn't find this trip."}
        </Text>
        <TouchableOpacity
          style={[styles.backCta, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backCtaText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const preferenceChips = [
    { icon: "wind", label: trip.preferences.smoking ? "Smoking OK" : "Non-smoking", active: !trip.preferences.smoking },
    { icon: "music", label: trip.preferences.music ? "Music on" : "No music", active: trip.preferences.music },
    { icon: "thermometer", label: trip.preferences.ac ? "AC on" : "No AC", active: trip.preferences.ac },
    { icon: "heart", label: trip.preferences.pets ? "Pets OK" : "No pets", active: trip.preferences.pets },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Adventure Details</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => Alert.alert("Share", "Sharing trip details...")}
        >
          <Feather name="share-2" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.driverCard, CARD_SHADOW]}>
          <DriverAvatar name={trip.driver.name} size={56} />
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, { color: colors.foreground }]}>{trip.driver.name}</Text>
            <View style={styles.ratingRow}>
              <Feather name="star" size={13} color="#C4954A" />
              <Text style={[styles.rating, { color: colors.mutedForeground }]}>
                {trip.driver.rating.toFixed(1)} · {trip.driver.trips} trip{trip.driver.trips !== 1 ? "s" : ""}
              </Text>
            </View>
            {trip.driver.isTopDriver && (
              <View style={[styles.topBadge, { backgroundColor: "#FEF3E2" }]}>
                <Feather name="award" size={11} color="#C4954A" />
                <Text style={[styles.topBadgeText, { color: "#C4954A" }]}>Top Voyager</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.msgBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.push({ pathname: "/chat/[id]", params: { id: "c1" } })}
          >
            <Feather name="message-circle" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.routeCard, CARD_SHADOW]}>
          <View style={styles.routeStop}>
            <View style={[styles.stopDot, { backgroundColor: colors.primary }]} />
            <View style={styles.stopInfo}>
              <Text style={[styles.stopCity, { color: colors.foreground }]}>{trip.fromCity}</Text>
              <Text style={[styles.stopTime, { color: colors.mutedForeground }]}>
                {formatTripTime(trip.departureAt)} — Departure
              </Text>
            </View>
          </View>
          <View style={styles.routeConnector}>
            <View style={[styles.connectorLine, { borderLeftColor: colors.border }]} />
            <View style={[styles.distanceBadge, { backgroundColor: colors.muted }]}>
              <Feather name="navigation" size={11} color={colors.mutedForeground} />
              <Text style={[styles.distanceText, { color: colors.mutedForeground }]}>~3 hrs</Text>
            </View>
          </View>
          <View style={styles.routeStop}>
            <View style={[styles.stopDot, { backgroundColor: colors.accent }]} />
            <View style={styles.stopInfo}>
              <Text style={[styles.stopCity, { color: colors.foreground }]}>{trip.toCity}</Text>
              <Text style={[styles.stopTime, { color: colors.mutedForeground }]}>
                {approximateArrivalTime(trip.departureAt)} — Approx arrival
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.detailsCard, CARD_SHADOW]}>
          {[
            { icon: "users", label: "Seats Available", value: String(trip.seatsAvailable) },
            { icon: "briefcase", label: "Luggage Space", value: `${trip.luggageSpace} bag${trip.luggageSpace !== 1 ? "s" : ""}` },
            { icon: "truck", label: "Vehicle", value: trip.car || "—" },
          ].map((row, i) => (
            <View key={row.label}>
              {i > 0 && <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />}
              <View style={styles.detailRow}>
                <View style={[styles.detailIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name={row.icon as any} size={14} color={colors.primary} />
                </View>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.prefsCard, CARD_SHADOW]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Adventure Preferences</Text>
          <View style={styles.prefChips}>
            {preferenceChips.map((p) => (
              <View
                key={p.label}
                style={[
                  styles.chip,
                  {
                    backgroundColor: p.active ? colors.secondary : colors.muted,
                    borderColor: p.active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Feather name={p.icon as any} size={12} color={p.active ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.chipText, { color: p.active ? colors.primary : colors.mutedForeground }]}>
                  {p.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {trip.note ? (
          <View style={[styles.aboutCard, CARD_SHADOW]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>About this trip</Text>
            <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>{trip.note}</Text>
          </View>
        ) : null}

        <View style={[styles.insuranceBadge, { backgroundColor: "#EBF2ED" }]}>
          <Feather name="shield" size={16} color={colors.primary} />
          <Text style={[styles.insuranceText, { color: colors.primary }]}>
            This trip is covered by Bovogo insurance
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <View>
          <Text style={[styles.footerPrice, { color: colors.primary }]}>${trip.pricePerSeat}</Text>
          <Text style={[styles.footerLabel, { color: colors.mutedForeground }]}>per seat</Text>
        </View>
        <TouchableOpacity
          style={[styles.requestBtn, { backgroundColor: colors.primary }]}
          onPress={handleRequest}
          activeOpacity={0.88}
        >
          <Text style={styles.requestBtnText}>Request Seat</Text>
          <Feather name="arrow-right" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
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
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 14 },
  driverCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  driverInfo: { flex: 1, gap: 5 },
  driverName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  rating: { fontSize: 13, fontFamily: "Inter_400Regular" },
  topBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  topBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  msgBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  routeCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20 },
  routeStop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  stopDot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  stopInfo: { flex: 1, gap: 4 },
  stopCity: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  stopTime: { fontSize: 13, fontFamily: "Inter_400Regular" },
  routeConnector: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingLeft: 5 },
  connectorLine: { height: 24, borderLeftWidth: 2, borderStyle: "dashed" },
  distanceBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginLeft: 16, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  distanceText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  detailsCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18 },
  detailRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  detailIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  detailLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  detailValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowDivider: { height: 1 },
  prefsCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, gap: 14 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  prefChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  aboutCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, gap: 10 },
  aboutText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  insuranceBadge: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14 },
  insuranceText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, paddingBottom: 30 },
  footerPrice: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  footerLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  requestBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, height: 52, borderRadius: 26 },
  requestBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
