import { CheckoutComplete } from "@/components/checkout/CheckoutComplete";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";
import { getBooking } from "@/lib/bookings";

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

  // A booking is a single object with no empty state of its own, so this is
  // here for the guarantees rather than the phases: a superseded request can no
  // longer land after a newer one, and a missing id fails loudly instead of
  // sitting on a spinner.
  const bookingRes = useAsyncResource(
    async () => {
      if (!id) throw new Error("Missing booking id");
      return getBooking(id);
    },
    { deps: [id], isEmpty: () => false },
  );

  const booking = bookingRes.data;
  const error = bookingRes.error?.message ?? null;

  if (
    booking &&
    (booking.status === "confirmed" || booking.status === "completed")
  )
    return <CheckoutComplete booking={booking} />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.container,
          { paddingTop: Platform.OS === "web" ? 67 : 20 },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.summaryCard,
              CARD_SHADOW,
              { backgroundColor: colors.card },
            ]}
          >
            {bookingRes.phase === "failed" ? (
              <>
                <Text
                  accessibilityRole="alert"
                  style={[styles.errorText, { color: colors.foreground }]}
                >
                  {error ?? "Booking details unavailable."}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => void bookingRes.reload()}
                  style={[
                    styles.secondaryBtn,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Text
                    style={[styles.secondaryBtnText, { color: colors.primary }]}
                  >
                    Try again
                  </Text>
                </TouchableOpacity>
              </>
            ) : booking ? (
              <>
                <Text
                  accessibilityRole="header"
                  style={[styles.heading, { color: colors.foreground }]}
                >
                  {booking.status === "confirmed"
                    ? "Booking confirmed"
                    : "Booking details"}
                </Text>
                <Text style={[styles.route, { color: colors.foreground }]}>
                  {cityShort(booking.trip.fromCity)} →{" "}
                  {cityShort(booking.trip.toCity)}
                </Text>
                <Text
                  style={[styles.detail, { color: colors.mutedForeground }]}
                >
                  {formatDate(booking.trip.departureAt)}
                </Text>
                <Text style={[styles.detail, { color: colors.foreground }]}>
                  {booking.seats} seat{booking.seats === 1 ? "" : "s"} ·{" "}
                  {booking.trip.driverName}
                </Text>
                <Text
                  style={[styles.detail, { color: colors.mutedForeground }]}
                >
                  Status: {booking.status}
                </Text>
                <Text style={[styles.total, { color: colors.foreground }]}>
                  Booking total: ${booking.totalAmount.toFixed(2)}
                </Text>
              </>
            ) : (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text
                  style={[styles.detail, { color: colors.mutedForeground }]}
                >
                  Loading your booking…
                </Text>
              </>
            )}
          </View>
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
              style={[
                styles.secondaryBtn,
                { backgroundColor: colors.secondary },
              ]}
              onPress={() => router.replace("/(tabs)/trips")}
              activeOpacity={0.88}
            >
              <Text
                style={[styles.secondaryBtnText, { color: colors.primary }]}
              >
                View My Adventures
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.secondaryBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.replace("/(tabs)")}
            activeOpacity={0.88}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>
              Back to Home
            </Text>
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
    gap: 14,
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  heading: { fontSize: 22, fontFamily: "Inter_600SemiBold" },
  route: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  detail: { fontSize: 14, fontFamily: "Inter_400Regular" },
  total: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  actions: { gap: 12 },
  primaryBtn: {
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
