import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";
import { getBooking, type Booking } from "@/lib/bookings";

function cityShort(c: string): string {
  return c.replace(/, TX$/, "").replace(/, AR$/, "");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })} · ${d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export default function BookingConfirmed() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 13, stiffness: 90 });
    opacity.value = withDelay(250, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(250, withSpring(0, { damping: 14 }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setLoading(false);
      setError("Missing booking id");
      return;
    }
    getBooking(id)
      .then((b) => {
        if (!cancelled) {
          setBooking(b);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Couldn't load booking");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const summaryRows = booking
    ? [
        {
          label: "Route",
          value: `${cityShort(booking.trip.fromCity)} → ${cityShort(booking.trip.toCity)}`,
        },
        { label: "Date & Time", value: formatDate(booking.trip.departureAt) },
        { label: "Voyager", value: booking.trip.driverName },
        {
          label: "Seats",
          value: `${booking.seats} seat${booking.seats === 1 ? "" : "s"}`,
        },
        { label: "Total Paid", value: `$${booking.totalAmount.toFixed(2)}` },
      ]
    : [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : 20 }]}>
        <View style={styles.content}>
          <Animated.View style={[styles.iconRing, iconStyle, { backgroundColor: "#EBF2ED" }]}>
            <View style={[styles.iconInner, { backgroundColor: colors.primary }]}>
              <Feather name="check" size={36} color="#fff" />
            </View>
          </Animated.View>

          <Animated.View style={[styles.textBlock, contentStyle]}>
            <Text style={[styles.title, { color: colors.foreground }]}>You're all set!</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Your seat is confirmed. Have a safe trip!
            </Text>
          </Animated.View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : error || !booking ? (
            <View style={[styles.summaryCard, CARD_SHADOW]}>
              <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
                {error || "Booking details unavailable."}
              </Text>
            </View>
          ) : (
            <Animated.View style={[styles.summaryCard, contentStyle, CARD_SHADOW]}>
              {summaryRows.map((row, i) => (
                <View key={row.label}>
                  {i > 0 && <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />}
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                    <Text style={[styles.summaryValue, { color: colors.foreground }]}>{row.value}</Text>
                  </View>
                </View>
              ))}
            </Animated.View>
          )}

          <Animated.View style={[styles.badges, contentStyle]}>
            <View style={[styles.badge, { backgroundColor: "#EBF2ED" }]}>
              <Feather name="shield" size={14} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>Adventure insured</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "#FEF3E2" }]}>
              <Feather name="award" size={14} color="#C4954A" />
              <Text style={[styles.badgeText, { color: "#C4954A" }]}>Verified driver</Text>
            </View>
          </Animated.View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace("/(tabs)/trips")}
            activeOpacity={0.88}
          >
            <Feather name="map-pin" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>View My Adventures</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.replace("/(tabs)")}
            activeOpacity={0.88}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 28 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  iconRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  iconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: { alignItems: "center", gap: 8 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  summaryCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 },
  rowDivider: { height: 1 },
  summaryLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  summaryValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  badges: { flexDirection: "row", gap: 10 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  actions: { gap: 12 },
  primaryBtn: {
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  secondaryBtn: {
    height: 52,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
