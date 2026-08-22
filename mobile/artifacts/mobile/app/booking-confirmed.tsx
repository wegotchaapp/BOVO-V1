import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
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
import { useAuth } from "@/context/AuthContext";
import { getBooking, type Booking } from "@/lib/bookings";
import { Ticket, ticketBox } from "@/components/Ticket";
import {
  PRINT_DURATION_MS,
  TicketPrinter,
  type PrinterStage,
} from "@/components/TicketPrinter";

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

/** Day and month, printed-ticket style: "05.09". */
function ticketDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

/** 24-hour departure, so it reads as a timetable rather than prose. */
function ticketTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A short human-quotable reference, derived from the departure date and booking id. */
function ticketReference(bookingId: string, departureAt: string): string {
  const d = new Date(departureAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const tail = bookingId.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
  return `BV-${stamp}-${tail || "0000"}`;
}

export default function BookingConfirmed() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState<PrinterStage>("processing");

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(250, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(250, withSpring(0, { damping: 14 }));
  }, []);

  // The printer only starts feeding once there is a real booking to print.
  useEffect(() => {
    if (loading || error || !booking) return;
    setStage("printing");
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    const timer = setTimeout(() => {
      setStage("complete");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
    }, PRINT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [loading, error, booking]);

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

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const ticketWidth = Math.round(Math.min(width * 0.50, 184));
  const { boxHeight: ticketHeight } = ticketBox(ticketWidth);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : 20 }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {error && !booking ? (
            <View style={[styles.summaryCard, CARD_SHADOW]}>
              <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
                {error || "Booking details unavailable."}
              </Text>
            </View>
          ) : (
            <TicketPrinter
              stage={stage}
              title={
                booking
                  ? `${cityShort(booking.trip.fromCity)} → ${cityShort(booking.trip.toCity)}`
                  : "Your adventure"
              }
              subtitle={
                booking
                  ? `${booking.seats} seat${booking.seats === 1 ? "" : "s"} · ${formatDate(booking.trip.departureAt)}`
                  : "Confirming your seat"
              }
              total={booking ? `$${booking.totalAmount.toFixed(2)}` : "—"}
              ticketHeight={ticketHeight}
            >
              {booking ? (
                <Ticket
                  fromCity={cityShort(booking.trip.fromCity)}
                  toCity={cityShort(booking.trip.toCity)}
                  date={ticketDate(booking.trip.departureAt)}
                  departs={ticketTime(booking.trip.departureAt)}
                  voyager={booking.trip.driverName}
                  seats={booking.seats}
                  reference={ticketReference(booking.id, booking.trip.departureAt)}
                  width={ticketWidth}
                />
              ) : null}
            </TicketPrinter>
          )}

          <Animated.View style={[styles.badges, contentStyle]}>
            {user?.isFoundingMember ? (
              <View style={[styles.badge, { backgroundColor: "#EBF2ED" }]}>
                <Feather name="shield" size={14} color={colors.primary} />
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  Adventure insured
                </Text>
              </View>
            ) : null}
            <View style={[styles.badge, { backgroundColor: "#C4954A" }]}>
              <Feather name="award" size={14} color="#111210" />
              <Text style={[styles.badgeText, { color: "#111210" }]}>Verified Voyager</Text>
            </View>
          </Animated.View>
        </ScrollView>

        <View style={styles.actions}>
          {booking?.groupId ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() =>
                router.replace({
                  pathname: "/group/[id]",
                  params: { id: booking.groupId! },
                })
              }
              activeOpacity={0.88}
            >
              <Feather name="message-circle" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Open Adventure group</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.replace("/(tabs)/trips")}
              activeOpacity={0.88}
            >
              <Feather name="map-pin" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>View My Adventures</Text>
            </TouchableOpacity>
          )}
          {booking?.groupId ? (
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: colors.secondary }]}
              onPress={() => router.replace("/(tabs)/trips")}
              activeOpacity={0.88}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>
                View My Adventures
              </Text>
            </TouchableOpacity>
          ) : null}
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
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 2,
  },
  summaryCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
  },
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
