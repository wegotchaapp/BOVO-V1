/**
 * Web platform TrackingMap — animated route visualization fallback.
 * On native (iOS/Android), TrackingMap.native.tsx is used instead,
 * which renders a real interactive Mapbox map via WebView.
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
  region: any;
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
