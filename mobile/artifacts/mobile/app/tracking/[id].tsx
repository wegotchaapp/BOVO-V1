import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import TrackingMap from "@/components/TrackingMap";
import { useColors } from "@/hooks/useColors";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import { useDriverSimulation } from "@/hooks/useDriverSimulation";
import { CARD_SHADOW } from "@/constants/colors";

const CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  dallas: { latitude: 32.7767, longitude: -96.797 },
  austin: { latitude: 30.2672, longitude: -97.7431 },
  houston: { latitude: 29.7604, longitude: -95.3698 },
  "san antonio": { latitude: 29.4241, longitude: -98.4936 },
  "fort worth": { latitude: 32.7555, longitude: -97.3308 },
  plano: { latitude: 33.0198, longitude: -96.6989 },
  waco: { latitude: 31.5493, longitude: -97.1467 },
  "corpus christi": { latitude: 27.8006, longitude: -97.3964 },
  lubbock: { latitude: 33.5779, longitude: -101.8552 },
  amarillo: { latitude: 35.222, longitude: -101.8313 },
  "el paso": { latitude: 31.7619, longitude: -106.485 },
  arlington: { latitude: 32.7357, longitude: -97.1081 },
};

function getCityCoord(city: string) {
  const key = city.toLowerCase().split(",")[0].trim();
  return CITY_COORDS[key] ?? CITY_COORDS.dallas;
}

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

export default function TripTracking() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const fromCity = "Dallas";
  const toCity = "Austin";
  const fromCoord = getCityCoord(fromCity);
  const toCoord = getCityCoord(toCity);

  // Real route data from Mapbox Directions API — received via postMessage from the map WebView
  const [routeDurationSeconds, setRouteDurationSeconds] = useState<number | undefined>(undefined);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | undefined>(undefined);

  // Simulated driver moving along the route (replaces with real driver GPS via WS in production).
  // routeDurationSeconds replaces the hardcoded 195-min fallback once the Mapbox route loads.
  const { driverCoord, progress, etaMinutes, etaSource } = useDriverSimulation(
    fromCoord,
    toCoord,
    0.32,
    195,
    routeDurationSeconds,
  );

  // Rider's real GPS location
  const { coord: riderCoord, hasPermission, error: locationError, isTracking } = useLiveLocation(true);

  // Region centers on driver, bounded to show full route
  const region = midpoint(fromCoord, toCoord);

  // Legacy currentCoord for prop compatibility
  const currentCoord = driverCoord;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  function handleShareLocation() {
    if (!riderCoord) {
      Alert.alert(
        "Location Unavailable",
        locationError ?? "Enable location access in Settings to share your live position.",
      );
      return;
    }
    Alert.alert(
      "Share Live Trip",
      `Your trip link has been copied. Your GPS position (${riderCoord.latitude.toFixed(4)}, ${riderCoord.longitude.toFixed(4)}) is being tracked.`,
    );
  }

  const speedText = riderCoord?.speed != null ? formatSpeed(riderCoord.speed) : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Live Tracking</Text>
            <Text style={[styles.headerRoute, { color: colors.mutedForeground }]}>
              {fromCity} → {toCity}
            </Text>
          </View>
          <View style={[styles.liveBadge, { backgroundColor: "#FEF3E2" }]}>
            <Animated.View style={[styles.liveDot, { backgroundColor: "#C4954A", transform: [{ scale: pulseAnim }] }]} />
            <Text style={[styles.liveText, { color: "#C4954A" }]}>LIVE</Text>
          </View>
        </View>

        {/* GPS status bar */}
        <View style={[styles.gpsBar, { backgroundColor: isTracking ? colors.secondary : colors.muted }]}>
          <Feather
            name={isTracking ? "map-pin" : "map"}
            size={12}
            color={isTracking ? colors.primary : colors.mutedForeground}
          />
          <Text style={[styles.gpsBarText, { color: isTracking ? colors.primary : colors.mutedForeground }]}>
            {isTracking
              ? `Your GPS active · ${riderCoord ? `${riderCoord.latitude.toFixed(4)}°N, ${Math.abs(riderCoord.longitude).toFixed(4)}°W` : "acquiring..."}${speedText ? ` · ${speedText}` : ""}`
              : locationError
              ? "Location permission needed — tap to enable"
              : "Acquiring GPS..."}
          </Text>
          {!isTracking && (
            <Feather name="chevron-right" size={12} color={colors.mutedForeground} />
          )}
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <TrackingMap
            region={region}
            fromCoord={fromCoord}
            toCoord={toCoord}
            currentCoord={currentCoord}
            driverCoord={driverCoord}
            riderCoord={riderCoord}
            fromLabel={`${fromCity}, TX`}
            toLabel={`${toCity}, TX`}
            primaryColor={colors.primary}
            borderColor={colors.border}
            accentColor={colors.accent}
            progress={progress}
            onRouteInfo={useCallback((info) => {
              setRouteDurationSeconds(info.durationSeconds);
              setRouteDistanceMeters(info.distanceMeters);
            }, [])}
          />

          {/* ETA overlay */}
          <View style={[styles.etaOverlay, { backgroundColor: "rgba(255,255,255,0.95)" }]}>
            <View style={styles.etaHeader}>
              <Text style={[styles.etaLabel, { color: colors.mutedForeground }]}>ETA</Text>
              {etaSource === "mapbox" && (
                <View style={[styles.etaSourceBadge, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.etaSourceText, { color: colors.primary }]}>LIVE MAP</Text>
                </View>
              )}
            </View>
            <Text style={[styles.etaTime, { color: colors.foreground }]}>{formatETA(etaMinutes)}</Text>
            {routeDistanceMeters != null && (
              <Text style={[styles.etaDistance, { color: colors.mutedForeground }]}>
                {((routeDistanceMeters / 1000) * 0.621371).toFixed(0)} mi total
              </Text>
            )}
          </View>

          {/* Progress pill */}
          <View style={[styles.progressPill, { backgroundColor: "rgba(27,61,47,0.9)" }]}>
            <View style={[styles.progressTrack, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: "#C4954A" }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          </View>
        </View>

        {/* Driver card */}
        <View style={[styles.driverCard, CARD_SHADOW]}>
          <View style={[styles.driverAvatar, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.driverInitials, { color: colors.primary }]}>JD</Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, { color: colors.foreground }]}>John D.</Text>
            <View style={styles.driverMeta}>
              <Text style={[styles.driverCar, { color: colors.mutedForeground }]}>Toyota Camry · TX-AB1234</Text>
              <View style={[styles.ratingChip, { backgroundColor: "#FEF3E2" }]}>
                <Feather name="star" size={10} color="#C4954A" />
                <Text style={[styles.ratingText, { color: "#C4954A" }]}>4.8</Text>
              </View>
            </View>
          </View>
          <View style={styles.driverActions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
              onPress={() => router.push({ pathname: "/chat/[id]", params: { id: "c1" } })}
            >
              <Feather name="message-circle" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.secondary }]}
              onPress={() => Alert.alert("Call Voyager", "Calling will be enabled before launch.")}
            >
              <Feather name="phone" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom actions */}
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
            onPress={() => router.push("/safety" as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.safetyText}>SOS</Text>
            <Text style={styles.safetySubText}>Hold for help</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center", gap: 2 },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerRoute: { fontSize: 11, fontFamily: "Inter_400Regular" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  gpsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 10,
  },
  gpsBarText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular" },
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  etaOverlay: {
    position: "absolute",
    top: 14,
    right: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  etaHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  etaLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  etaSourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  etaSourceText: { fontSize: 8, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  etaTime: { fontSize: 18, fontFamily: "Inter_700Bold" },
  etaDistance: { fontSize: 9, fontFamily: "Inter_400Regular", marginTop: 1 },
  progressPill: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  progressTrack: { flex: 1, height: 5, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 5, borderRadius: 3 },
  progressText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold", minWidth: 32, textAlign: "right" },
  driverCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  driverInitials: { fontSize: 18, fontFamily: "Inter_700Bold" },
  driverInfo: { flex: 1, gap: 4 },
  driverName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  driverMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  driverCar: { fontSize: 12, fontFamily: "Inter_400Regular" },
  ratingChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  ratingText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  driverActions: { flexDirection: "row", gap: 8 },
  actionBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  bottomActions: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  shareBtn: {
    width: 110,
    height: 50,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  shareBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  safetyBtn: {
    flex: 1,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  safetyText: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 1 },
  safetySubText: { fontSize: 9, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", letterSpacing: 0.3 },
});
