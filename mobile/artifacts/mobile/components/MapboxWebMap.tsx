/**
 * Web platform fallback for MapboxWebMap.
 * react-native-webview is not supported on web, so this renders
 * an animated route visualization instead.
 * On iOS/Android (Expo Go), MapboxWebMap.native.tsx is used instead,
 * which renders a real interactive Mapbox map via WebView.
 */
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

interface Coord {
  latitude: number;
  longitude: number;
}

interface RouteInfo {
  durationSeconds: number;
  distanceMeters: number;
}

interface MapboxWebMapProps {
  fromCoord: Coord;
  toCoord: Coord;
  driverCoord: Coord;
  riderCoord: Coord | null;
  fromLabel: string;
  toLabel: string;
  progress: number;
  primaryColor?: string;
  accentColor?: string;
  onRouteInfo?: (info: RouteInfo) => void;
  style?: object;
}

export default function MapboxWebMap({
  fromLabel,
  toLabel,
  progress,
  riderCoord,
  primaryColor = "#1B3D2F",
  accentColor = "#C4954A",
  onRouteInfo: _onRouteInfo,
  style,
}: MapboxWebMapProps) {
  const carPos = useRef(new Animated.Value(progress)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(carPos, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const carLeft = carPos.interpolate({
    inputRange: [0, 1],
    outputRange: ["2%", "82%"],
  });

  const doneWidth = carPos.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "84%"],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }, style]}>
      {/* Map background with subtle grid */}
      <View style={[styles.mapBg, { backgroundColor: "#f0ebe3" }]}>
        {[...Array(7)].map((_, i) => (
          <View key={`h${i}`} style={[styles.gridH, { top: `${(i + 1) * 12}%` as any }]} />
        ))}
        {[...Array(9)].map((_, i) => (
          <View key={`v${i}`} style={[styles.gridV, { left: `${(i + 1) * 10}%` as any }]} />
        ))}
        {/* Faux road labels */}
        <Text style={[styles.roadLabel, { top: "20%", left: "15%" }]}>I-35</Text>
        <Text style={[styles.roadLabel, { top: "55%", left: "60%" }]}>US-290</Text>
        <Text style={[styles.roadLabel, { top: "35%", left: "40%", opacity: 0.6 }]}>Georgetown</Text>
        <Text style={[styles.roadLabel, { top: "70%", left: "25%", opacity: 0.6 }]}>Round Rock</Text>
      </View>

      {/* From callout — top left */}
      <View style={[styles.callout, styles.calloutLeft, { backgroundColor: "#fff" }]}>
        <View style={[styles.calloutDot, { backgroundColor: primaryColor }]} />
        <Text style={styles.calloutText} numberOfLines={1}>From {fromLabel}</Text>
        <Feather name="chevron-right" size={12} color="#666" />
      </View>

      {/* To callout — bottom right */}
      <View style={[styles.callout, styles.calloutRight, { backgroundColor: "#fff" }]}>
        <View style={[styles.calloutDot, { backgroundColor: accentColor }]} />
        <Text style={styles.calloutText} numberOfLines={1}>To {toLabel}</Text>
        <Feather name="chevron-right" size={12} color="#666" />
      </View>

      {/* Route track */}
      <View style={styles.routeArea}>
        <View style={styles.routeTrack}>
          {/* Remaining route — dark navy */}
          <View style={[styles.routeRemaining, { backgroundColor: "#1a1a2e" }]} />

          {/* Completed route — Bovogo green overlay */}
          <Animated.View
            style={[styles.routeCompleted, { width: doneWidth, backgroundColor: primaryColor }]}
          />

          {/* Origin dot */}
          <View style={[styles.originDot, { backgroundColor: primaryColor, borderColor: "#fff" }]} />

          {/* Destination dot */}
          <View style={[styles.destDot, { backgroundColor: accentColor, borderColor: "#fff" }]}>
            <Text style={styles.starText}>★</Text>
          </View>

          {/* Driver car */}
          <Animated.View style={[styles.carWrap, { left: carLeft }]}>
            <Animated.View
              style={[
                styles.carPulse,
                {
                  backgroundColor: primaryColor + "30",
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <View style={[styles.carDot, { backgroundColor: primaryColor, borderColor: "#fff" }]}>
              <Text style={styles.carEmoji}>🚗</Text>
            </View>
          </Animated.View>
        </View>
      </View>

      {/* Progress + label row */}
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <View style={[styles.infoDot, { backgroundColor: primaryColor }]} />
          <Text style={[styles.infoCity, { color: primaryColor }]}>{fromLabel}</Text>
        </View>
        <Text style={[styles.infoPct, { color: primaryColor }]}>
          {Math.round(progress * 100)}% complete
        </Text>
        <View style={styles.infoItem}>
          <View style={[styles.infoDot, { backgroundColor: accentColor }]} />
          <Text style={[styles.infoCity, { color: accentColor }]}>{toLabel}</Text>
        </View>
      </View>

      {/* GPS / notice */}
      {riderCoord ? (
        <View style={[styles.gpsChip, { backgroundColor: "#EBF5FF", borderColor: "#93C5FD" }]}>
          <Feather name="map-pin" size={11} color="#3B82F6" />
          <Text style={[styles.gpsText, { color: "#3B82F6" }]}>Your GPS active</Text>
        </View>
      ) : (
        <View style={[styles.gpsChip, { backgroundColor: primaryColor + "12", borderColor: primaryColor + "30" }]}>
          <Feather name="info" size={11} color={primaryColor} />
          <Text style={[styles.gpsText, { color: primaryColor }]}>
            Open in Expo Go for the live Mapbox map
          </Text>
        </View>
      )}

      {/* Zoom controls — cosmetic, matching image */}
      <View style={[styles.zoomControls, { backgroundColor: "#fff" }]}>
        <Text style={styles.zoomBtn}>+</Text>
        <View style={[styles.zoomDivider, { backgroundColor: "#E5E7EB" }]} />
        <Text style={styles.zoomBtn}>−</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative", overflow: "hidden" },
  mapBg: { ...StyleSheet.absoluteFillObject },
  gridH: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "#c8bfaa", opacity: 0.35 },
  gridV: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "#c8bfaa", opacity: 0.35 },
  roadLabel: { position: "absolute", fontSize: 10, color: "#9CA3AF", fontFamily: "Inter_500Medium" },

  callout: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    maxWidth: 180,
  },
  calloutLeft: { top: 16, left: 14 },
  calloutRight: { bottom: 60, right: 14 },
  calloutDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  calloutText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#111", flex: 1 },

  routeArea: {
    position: "absolute",
    top: "35%",
    left: "8%",
    right: "8%",
    height: 60,
    justifyContent: "center",
  },
  routeTrack: { height: 7, borderRadius: 4, position: "relative", overflow: "visible" },
  routeRemaining: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: 4 },
  routeCompleted: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4 },

  originDot: {
    position: "absolute",
    left: -6,
    top: -5,
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  destDot: {
    position: "absolute",
    right: -6,
    top: -8,
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  starText: { color: "#fff", fontSize: 9 },

  carWrap: {
    position: "absolute",
    top: -20,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -22,
  },
  carPulse: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  carDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  carEmoji: { fontSize: 18 },

  infoRow: {
    position: "absolute",
    bottom: 32,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  infoDot: { width: 7, height: 7, borderRadius: 4 },
  infoCity: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  infoPct: { fontSize: 11, fontFamily: "Inter_500Medium" },

  gpsChip: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  gpsText: { fontSize: 10, fontFamily: "Inter_400Regular" },

  zoomControls: {
    position: "absolute",
    bottom: 56,
    right: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
    overflow: "hidden",
    width: 36,
  },
  zoomBtn: {
    textAlign: "center",
    lineHeight: 36,
    fontSize: 22,
    color: "#333",
    height: 36,
  },
  zoomDivider: { height: 1 },
});
