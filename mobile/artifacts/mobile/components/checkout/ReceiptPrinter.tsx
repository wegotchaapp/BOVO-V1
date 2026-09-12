import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { Booking } from "@/lib/bookings";
import { TravelTicket } from "./TravelTicket";
import { FEED_DURATION, FEED_POSITIONS, FEED_TIMES } from "./motion";
import { useReducedMotion } from "./useReducedMotion";

export function ReceiptPrinter({ booking }: { booking: Booking }) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(360, screenWidth - 48);
  const paperWidth = Math.min(272, width * 0.8);
  const paperHeight = paperWidth * 2.4;
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const [stage, setStage] = useState<"processing" | "printing" | "complete">(
    "processing",
  );
  const generation = useRef(0);
  const statusOpacity = useSharedValue(1);
  useEffect(() => {
    statusOpacity.value = reduced ? 1 : 0;
    statusOpacity.value = withTiming(1, { duration: reduced ? 0 : 180 });
  }, [stage, reduced, statusOpacity]);
  const statusStyle = useAnimatedStyle(() => ({
    opacity: statusOpacity.value,
  }));
  useEffect(() => {
    if (reduced === null) return;
    const current = ++generation.current;
    const finish = () => {
      if (generation.current === current) setStage("complete");
    };
    setStage("processing");
    progress.value = 0;
    const timer = setTimeout(
      () => {
        setStage("printing");
        progress.value = withTiming(
          1,
          { duration: reduced ? 0 : FEED_DURATION, easing: Easing.linear },
          (done) => {
            if (done) runOnJS(finish)();
          },
        );
      },
      reduced ? 0 : 550,
    );
    return () => {
      generation.current++;
      clearTimeout(timer);
      cancelAnimation(progress);
    };
  }, [booking.id, progress, reduced]);
  const paperStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          interpolate(progress.value, FEED_TIMES, FEED_POSITIONS) *
          (paperHeight - 2),
      },
    ],
  }));
  return (
    <View style={{ width, alignItems: "center", paddingBottom: 22 }}>
      <LinearGradient
        colors={["#363835", "#2D302C", "#292C28"]}
        style={[styles.machine, { width }]}
      >
        <View style={styles.header}>
          <View style={styles.logo}>
            <Feather name="navigation" size={17} color="#D9AF6A" />
          </View>
          <Text style={styles.brand}>bovogo</Text>
          <Text style={styles.small}>ADVENTURE CLUB</Text>
        </View>
        <View style={styles.screen}>
          <View style={styles.screenRow}>
            <Text style={styles.route} numberOfLines={1}>
              {booking.trip.fromCity.split(",")[0]} →{" "}
              {booking.trip.toCity.split(",")[0]}
            </Text>
            <Text style={styles.amount}>${booking.totalAmount.toFixed(2)}</Text>
          </View>
          <Animated.View
            style={[styles.status, statusStyle]}
            accessibilityLiveRegion="polite"
          >
            {stage === "complete" ? (
              <Feather name="check-circle" color="#A8DCB0" size={15} />
            ) : (
              <ActivityIndicator size="small" color="#9EA8A0" />
            )}
            <Text
              style={[
                styles.statusText,
                stage === "complete" && { color: "#A8DCB0" },
              ]}
            >
              {stage === "complete"
                ? "Your ticket is ready"
                : stage === "printing"
                  ? "Printing your adventure…"
                  : "Preparing your ticket…"}
            </Text>
          </Animated.View>
        </View>
        <View style={styles.slot} />
      </LinearGradient>
      <View
        style={{
          width: paperWidth + 48,
          height: paperHeight + 32,
          overflow: "hidden",
          // The aperture is 16 px above the case bottom. Paper clips at
          // its centre and passes IN FRONT of the lower case, not behind it.
          marginTop: -16,
          zIndex: 3,
          alignItems: "center",
        }}
      >
        <Animated.View
          aria-hidden={stage !== "complete"}
          accessibilityElementsHidden={stage !== "complete"}
          importantForAccessibility={
            stage !== "complete" ? "no-hide-descendants" : "auto"
          }
          style={[
            {
              opacity: stage === "processing" ? 0 : 1,
              boxShadow:
                "0 3px 6px rgba(12,20,14,0.10), 0 14px 24px rgba(12,20,14,0.12)",
            },
            paperStyle,
          ]}
        >
          <TravelTicket booking={booking} width={paperWidth} tilt={false} />
        </Animated.View>
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,.72)", "rgba(0,0,0,.25)", "rgba(0,0,0,0)"]}
          locations={[0, 0.23, 1]}
          style={{
            position: "absolute",
            top: 0,
            width: paperWidth,
            height: 22,
            opacity: stage === "processing" ? 0 : 1,
          }}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  machine: {
    height: 184,
    padding: 12,
    paddingBottom: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#393D37",
    zIndex: 2,
    boxShadow:
      "0 2px 3px rgba(10,18,12,.16), 0 12px 20px rgba(10,18,12,.16), inset 0 1px 0 rgba(255,255,255,.07)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#131713",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: "#F3F5EF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  small: {
    marginLeft: "auto",
    color: "#8D978F",
    fontSize: 7,
    letterSpacing: 1.3,
  },
  screen: {
    height: 100,
    backgroundColor: "#1C1F1B",
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#242822",
    boxShadow: "inset 0 2px 8px rgba(0,0,0,.22)",
  },
  screenRow: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  route: {
    color: "#E0E7DF",
    fontSize: 11,
    flex: 1,
    fontFamily: "Inter_500Medium",
  },
  amount: { color: "#D9AF6A", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  status: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 17 },
  statusText: { color: "#9EA8A0", fontSize: 11 },
  slot: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 12,
    height: 8,
    borderRadius: 5,
    backgroundColor: "#111410",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,.10)",
    boxShadow: "inset 0 2px 3px rgba(0,0,0,.8)",
  },
});
