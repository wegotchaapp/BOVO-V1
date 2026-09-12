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
  const paperWidth = Math.min(224, width * 0.73);
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
        colors={["#303332", "#181B19", "#101311"]}
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
          width: paperWidth + 22,
          height: paperHeight,
          overflow: "hidden",
          marginTop: -12,
          zIndex: 1,
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
              boxShadow: "0 12px 14px rgba(17, 31, 23, 0.13)",
            },
            paperStyle,
          ]}
        >
          <TravelTicket
            booking={booking}
            width={paperWidth}
            tilt={stage === "complete"}
          />
        </Animated.View>
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(0,0,0,.5)", "transparent"]}
          style={{
            position: "absolute",
            top: 0,
            width: paperWidth,
            height: 15,
          }}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  machine: {
    padding: 16,
    paddingBottom: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#424740",
    zIndex: 2,
    boxShadow: "0 10px 24px rgba(20,30,23,.16)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
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
    backgroundColor: "#090D0A",
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#363D36",
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
    height: 8,
    marginTop: 15,
    borderRadius: 5,
    backgroundColor: "#030503",
    borderBottomWidth: 1,
    borderColor: "#535A52",
  },
});
