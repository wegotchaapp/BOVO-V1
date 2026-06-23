import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";
import { formatTripTime, type Trip } from "@/data/trips";

interface TripCardProps {
  trip: Trip;
  onPress?: () => void;
}

function DriverAvatar({ name, size = 42 }: { name: string; size?: number }) {
  const colors = useColors();
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.secondary },
      ]}
    >
      <Text style={[styles.avatarText, { color: colors.primary, fontSize: size * 0.36 }]}>
        {initials}
      </Text>
    </View>
  );
}

export { DriverAvatar };

export default function TripCard({ trip, onPress }: TripCardProps) {
  const colors = useColors();
  const router = useRouter();

  function handlePress() {
    if (onPress) {
      onPress();
    } else {
      router.push(`/trip/${trip.id}`);
    }
  }

  return (
    <TouchableOpacity
      style={[styles.card, CARD_SHADOW]}
      onPress={handlePress}
      activeOpacity={0.92}
    >
      <View style={styles.topRow}>
        <View style={styles.timeBlock}>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>
            {formatTripTime(trip.departureAt)}
          </Text>
          {trip.driver.isTopDriver && (
            <View style={[styles.topBadge, { backgroundColor: "#FEF3E2" }]}>
              <Feather name="award" size={10} color="#C4954A" />
              <Text style={[styles.topBadgeText, { color: "#C4954A" }]}>Top Voyager</Text>
            </View>
          )}
        </View>
        <View style={styles.priceBlock}>
          <Text style={[styles.price, { color: colors.primary }]}>${trip.pricePerSeat}</Text>
          <Text style={[styles.perSeat, { color: colors.mutedForeground }]}>per seat</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.body}>
        <DriverAvatar name={trip.driver.name} />
        <View style={styles.info}>
          <Text style={[styles.driverName, { color: colors.foreground }]}>{trip.driver.name}</Text>
          <View style={styles.ratingRow}>
            <Feather name="star" size={11} color="#C4954A" />
            <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>
              {trip.driver.rating.toFixed(1)}
            </Text>
            {trip.car ? (
              <>
                <View style={[styles.dot, { backgroundColor: colors.border }]} />
                <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>{trip.car}</Text>
              </>
            ) : null}
          </View>
        </View>
        <View style={[styles.seatsBadge, { backgroundColor: colors.secondary }]}>
          <Feather name="users" size={12} color={colors.primary} />
          <Text style={[styles.seatsText, { color: colors.primary }]}>{trip.seatsAvailable}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 18,
    marginBottom: 14,
    gap: 14,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  timeBlock: { gap: 6 },
  time: { fontSize: 13, fontFamily: "Inter_500Medium", letterSpacing: 0.2 },
  topBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  topBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  priceBlock: { alignItems: "flex-end" },
  price: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  perSeat: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  divider: { height: 1 },
  body: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Inter_700Bold" },
  info: { flex: 1, gap: 5 },
  driverName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  seatsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  seatsText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
