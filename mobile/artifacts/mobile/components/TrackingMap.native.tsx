/**
 * Native TrackingMap — uses Mapbox GL JS via WebView.
 * Works in Expo Go on iOS and Android without a native build.
 * When EAS Build is set up, can optionally swap to @rnmapbox/maps
 * for offline maps and deeper native integration.
 */
import React from "react";
import { StyleSheet, View } from "react-native";

import MapboxWebMap from "./MapboxWebMap";

interface Coord {
  latitude: number;
  longitude: number;
}

interface RouteInfo {
  durationSeconds: number;
  distanceMeters: number;
}

interface TrackingMapProps {
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  fromCoord: Coord;
  toCoord: Coord;
  currentCoord: Coord;
  driverCoord: Coord;
  riderCoord: Coord | null;
  fromLabel: string;
  toLabel: string;
  primaryColor: string;
  borderColor: string;
  accentColor: string;
  progress: number;
  onRouteInfo?: (info: RouteInfo) => void;
}

export default function TrackingMap({
  fromCoord,
  toCoord,
  driverCoord,
  riderCoord,
  fromLabel,
  toLabel,
  primaryColor,
  accentColor,
  progress,
  onRouteInfo,
}: TrackingMapProps) {
  return (
    <View style={styles.container}>
      <MapboxWebMap
        fromCoord={fromCoord}
        toCoord={toCoord}
        driverCoord={driverCoord}
        riderCoord={riderCoord}
        fromLabel={fromLabel}
        toLabel={toLabel}
        progress={progress}
        primaryColor={primaryColor}
        accentColor={accentColor}
        onRouteInfo={onRouteInfo}
        style={styles.map}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
