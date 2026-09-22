import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Alert } from "@/lib/alert";

import TrackingMap from "@/components/TrackingMap";
import { useColors } from "@/hooks/useColors";
import { useTripLiveTracking } from "@/hooks/useTripLiveTracking";
import { CARD_SHADOW } from "@/constants/colors";
import { getBooking, type Booking } from "@/lib/bookings";
import { cityShort, getCityCoord } from "@/lib/city-coords";
import { MANUAL_CALL_911_MESSAGE, openDialer, triggerSos } from "@/lib/safety";
import { normalizeDialablePhone } from "@/lib/tracking";

function midpoint(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
    latitudeDelta: Math.abs(a.latitude - b.latitude) * 1.8 + 1.5,
    longitudeDelta: Math.abs(a.longitude - b.longitude) * 1.8 + 1.5,
  };
}

function formatETA(minutes: number) {
  if (minutes <= 0) return "Arrived";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatSpeed(mps: number | undefined) {
  if (mps == null || mps < 0) return null;
  const mph = mps * 2.237;
  return `${Math.round(mph)} mph`;
}

function mapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

export default function TripTracking() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingLoading, setBookingLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setBookingLoading(false);
      return;
    }
    let cancelled = false;
    setBookingLoading(true);
    getBooking(id)
      .then((b) => {
        if (!cancelled) setBooking(b);
      })
      .catch(() => {
        if (!cancelled) setBooking(null);
      })
      .finally(() => {
        if (!cancelled) setBookingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const fromCityFull = booking?.trip.fromCity ?? "Austin, TX";
  const toCityFull = booking?.trip.toCity ?? "Houston, TX";
  const fromCity = cityShort(fromCityFull);
  const toCity = cityShort(toCityFull);
  const fromCoord = useMemo(() => getCityCoord(fromCityFull), [fromCityFull]);
  const toCoord = useMemo(() => getCityCoord(toCityFull), [toCityFull]);

  const [routeDurationSeconds, setRouteDurationSeconds] = useState<
    number | undefined
  >(undefined);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<
    number | undefined
  >(undefined);

  const live = useTripLiveTracking(
    booking?.id,
    fromCoord,
    toCoord,
    routeDurationSeconds,
  );

  const driverName = live.snapshot?.driver.name ?? booking?.trip.driverName ?? "Voyager";
  const driverCar =
    live.snapshot?.driver.car || booking?.trip.car || "Vehicle";
  const driverPhone = live.snapshot?.driver.phone ?? null;
  const driverInitials = driverName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Prefer live driver GPS; fall back to route start until Voyager shares GPS.
  const driverCoord = live.driverCoord ?? (fromCoord ? {
    latitude: fromCoord.latitude,
    longitude: fromCoord.longitude,
    heading: 0,
  } : null);
  const riderCoord = live.riderCoord;
  const progress = live.progress;
  const etaMinutes = live.etaMinutes;
  const etaSource = live.etaSource;
  const region = fromCoord && toCoord ? midpoint(fromCoord, toCoord) : null;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.5,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const onRouteInfo = useCallback(
    (info: { durationSeconds: number; distanceMeters: number }) => {
      setRouteDurationSeconds(info.durationSeconds);
      setRouteDistanceMeters(info.distanceMeters);
    },
    [],
  );

  async function handleShareLocation() {
    const point = live.myCoord;
    if (!point) {
      Alert.alert(
        "Location unavailable",
        live.locationError ??
          "Enable location access in Settings to share your live position.",
      );
      return;
    }
    const link = mapsUrl(point.latitude, point.longitude);
    const message = `I'm on a Bovogo adventure (${fromCity} → ${toCity}). Where I am right now: ${link}`;
    try {
      await Share.share(
        Platform.OS === "ios"
          ? { message, url: link }
          : { message: `${message}` },
      );
    } catch (e: any) {
      if (e?.message?.includes("dismiss") || e?.message?.includes("cancel")) {
        return;
      }
      Alert.alert("Couldn't share", e?.message ?? "Please try again.");
    }
  }

  function handleSOS() {
    Alert.alert(
      "Activate SOS?",
      "This will text your emergency contact with your live location and open a call and text to 911.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Activate SOS",
          style: "destructive",
          onPress: () => {
            // Pass the already-live GPS fix so the flow doesn't wait for a new one.
            triggerSos({
              coord: live.myCoord
                ? {
                    latitude: live.myCoord.latitude,
                    longitude: live.myCoord.longitude,
                  }
                : null,
              tripId: booking?.tripId,
              onManualCall: () =>
                Alert.alert("Call 911 yourself", MANUAL_CALL_911_MESSAGE),
            });
          },
        },
      ],
    );
  }

  async function handleCallVoyager() {
    const dialable = normalizeDialablePhone(driverPhone);
    if (!dialable) {
      Alert.alert(
        "Phone unavailable",
        "The Voyager has not added a phone number to their profile yet.",
      );
      return;
    }
    // `canOpenURL` used to guard this, but on web it always resolves `true` and
    // `openURL` never rejects — so the guard passed, the tel: URL unloaded the
    // running app, and neither branch below could ever report it. The returned
    // result is the only reliable signal.
    const result = await openDialer(dialable);
    if (result !== "opened") {
      Alert.alert(
        "Call them from your phone",
        `Dial ${driverPhone} to reach your Voyager.`,
      );
    }
  }

  const speedText =
    live.myCoord?.speed != null ? formatSpeed(live.myCoord.speed) : null;

  if (bookingLoading || (booking && live.loading && !live.snapshot)) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>
          Adventure not found
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const gpsLabel = live.myGpsActive
    ? `Your GPS active${speedText ? ` · ${speedText}` : ""}${
        live.driverGpsLive ? " · Voyager GPS live" : " · Waiting for Voyager GPS"
      }`
    : live.locationError
      ? "Location permission needed — enable in Settings"
      : "Acquiring GPS...";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe}>
        <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Live Tracking
            </Text>
            <Text style={[styles.headerRoute, { color: colors.mutedForeground }]}>
              {fromCity} → {toCity}
            </Text>
          </View>
          <View style={[styles.liveBadge, { backgroundColor: "#FEF3E2" }]}>
            <Animated.View
              style={[
                styles.liveDot,
                {
                  backgroundColor: live.driverGpsLive ? "#16A34A" : "#C4954A",
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <Text
              style={[
                styles.liveText,
                { color: live.driverGpsLive ? "#16A34A" : "#C4954A" },
              ]}
            >
              {live.driverGpsLive ? "LIVE" : "WAIT"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.gpsBar,
            { backgroundColor: live.myGpsActive ? colors.secondary : colors.muted },
          ]}
        >
          <Feather
            name={live.myGpsActive ? "map-pin" : "map"}
            size={12}
            color={live.myGpsActive ? colors.primary : colors.mutedForeground}
          />
          <Text
            style={[
              styles.gpsBarText,
              {
                color: live.myGpsActive ? colors.primary : colors.mutedForeground,
              },
            ]}
          >
            {gpsLabel}
          </Text>
        </View>

        <View style={styles.mapContainer}>
          {fromCoord && toCoord && driverCoord && region ? <>
          <TrackingMap
            region={region}
            fromCoord={fromCoord}
            toCoord={toCoord}
            currentCoord={driverCoord}
            driverCoord={driverCoord}
            riderCoord={riderCoord}
            fromLabel={fromCityFull}
            toLabel={toCityFull}
            primaryColor={colors.primary}
            borderColor={colors.border}
            accentColor={colors.accent}
            progress={progress}
            onRouteInfo={onRouteInfo}
          />

          <View style={[styles.etaOverlay, { backgroundColor: "rgba(255,255,255,0.95)" }]}>
            <View style={styles.etaHeader}>
              <Text style={[styles.etaLabel, { color: colors.mutedForeground }]}>ETA</Text>
              <View
                style={[
                  styles.etaSourceBadge,
                  {
                    backgroundColor:
                      etaSource === "live" ? "#ECFDF5" : colors.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.etaSourceText,
                    {
                      color: etaSource === "live" ? "#059669" : colors.primary,
                    },
                  ]}
                >
                  {etaSource === "live" ? "LIVE GPS" : "ESTIMATE"}
                </Text>
              </View>
            </View>
            <Text style={[styles.etaTime, { color: colors.foreground }]}>
              {formatETA(etaMinutes)}
            </Text>
            {routeDistanceMeters != null && (
              <Text style={[styles.etaDistance, { color: colors.mutedForeground }]}>
                {((routeDistanceMeters / 1000) * 0.621371).toFixed(0)} mi route
              </Text>
            )}
          </View>

          <View style={[styles.progressPill, { backgroundColor: "rgba(27,61,47,0.9)" }]}>
            <View
              style={[styles.progressTrack, { backgroundColor: "rgba(255,255,255,0.25)" }]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round(progress * 100)}%` as any,
                    backgroundColor: "#C4954A",
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          </View>
          </> : <Text accessibilityRole="text" style={{ padding: 24, color: colors.foreground }}>
            Route map and arrival estimate unavailable. Your trip details and safety actions remain available below.
          </Text>}
        </View>

        <View style={[styles.driverCard, CARD_SHADOW]}>
          <View style={[styles.driverAvatar, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.driverInitials, { color: colors.primary }]}>
              {driverInitials}
            </Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, { color: colors.foreground }]}>
              {driverName}
            </Text>
            <View style={styles.driverMeta}>
              <Text style={[styles.driverCar, { color: colors.mutedForeground }]}>
                {driverCar}
              </Text>
            </View>
          </View>
          <View style={styles.driverActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
              onPress={() => {
                if (booking.groupId) {
                  router.push({
                    pathname: "/group/[id]",
                    params: { id: booking.groupId },
                  });
                  return;
                }
                Alert.alert(
                  "Group chat",
                  "Private chat opens after booking is confirmed.",
                );
              }}
            >
              <Feather name="message-circle" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
              onPress={handleCallVoyager}
            >
              <Feather name="phone" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.secondary }]}
            onPress={handleShareLocation}
            activeOpacity={0.88}
          >
            <Feather name="share-2" size={14} color={colors.primary} />
            <Text style={[styles.shareBtnText, { color: colors.primary }]}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.safetyBtn, { backgroundColor: "#DC2626" }]}
            onPress={handleSOS}
            activeOpacity={0.85}
          >
            <Text style={styles.safetyText}>SOS</Text>
            <Text style={styles.safetySubText}>Tap for help</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center", gap: 2 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  headerRoute: { fontSize: 12, fontFamily: "Inter_400Regular" },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  gpsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  gpsBarText: { flex: 1, fontSize: 11, fontFamily: "Inter_500Medium" },
  mapContainer: { flex: 1, marginHorizontal: 12, borderRadius: 20, overflow: "hidden" },
  etaOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 100,
  },
  etaHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  etaLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6 },
  etaSourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  etaSourceText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  etaTime: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 2 },
  etaDistance: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  progressPill: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  progressText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  driverCard: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  driverInitials: { fontSize: 15, fontFamily: "Inter_700Bold" },
  driverInfo: { flex: 1, gap: 3 },
  driverName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  driverMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  driverCar: { fontSize: 12, fontFamily: "Inter_400Regular" },
  driverActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 24 : 16,
  },
  shareBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  safetyBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  safetyText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  safetySubText: { color: "rgba(255,255,255,0.85)", fontSize: 10, fontFamily: "Inter_400Regular" },
});
