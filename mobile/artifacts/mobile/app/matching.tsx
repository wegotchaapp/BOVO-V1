import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
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

const MATCH_POINTS = [
  { icon: "wind", label: "Non-smoking", match: true },
  { icon: "music", label: "Background music", match: true },
  { icon: "thermometer", label: "AC preferred", match: true },
  { icon: "message-square", label: "Moderate talker", match: true },
  { icon: "heart", label: "No pets", match: true },
  { icon: "map-pin", label: "No extra stops", match: false },
];

export default function Matching() {
  const colors = useColors();
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const scoreScale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    scoreScale.value = withDelay(300, withSpring(1, { damping: 14, stiffness: 80 }));
    opacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(200, withSpring(0, { damping: 15 }));
  }, []);

  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
    opacity: opacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : 16 }]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Compatibility</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.scoreSection}>
          <Animated.View style={[styles.scoreRing, scoreStyle, { borderColor: colors.primary }]}>
            <View style={[styles.scoreInner, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.scoreNum, { color: colors.primary }]}>95%</Text>
              <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>Match</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.scoreTextBlock, contentStyle]}>
            <Text style={[styles.matchTitle, { color: colors.foreground }]}>Excellent Match!</Text>
            <Text style={[styles.matchSub, { color: colors.mutedForeground }]}>
              You and John D. are highly compatible travel partners.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.pointsCard, CARD_SHADOW, contentStyle]}>
          <Text style={[styles.pointsTitle, { color: colors.foreground }]}>Compatibility Details</Text>
          <View style={styles.points}>
            {MATCH_POINTS.map((p) => (
              <View key={p.label} style={styles.pointRow}>
                <View
                  style={[
                    styles.pointIcon,
                    { backgroundColor: p.match ? colors.secondary : "#FEF0F0" },
                  ]}
                >
                  <Feather
                    name={p.icon as any}
                    size={14}
                    color={p.match ? colors.primary : colors.destructive}
                  />
                </View>
                <Text style={[styles.pointLabel, { color: colors.foreground }]}>{p.label}</Text>
                <Feather
                  name={p.match ? "check-circle" : "x-circle"}
                  size={16}
                  color={p.match ? colors.success : colors.destructive}
                />
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={[styles.actions, contentStyle]}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() =>
              router.push({ pathname: "/payment", params: tripId ? { tripId } : {} })
            }
            activeOpacity={0.88}
          >
            <Text style={styles.primaryBtnText}>Continue to Payment</Text>
            <Feather name="arrow-right" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { backgroundColor: colors.secondary }]}
            onPress={() => router.replace("/(tabs)")}
            activeOpacity={0.88}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>
              Browse Other Rides
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 28 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  scoreSection: { alignItems: "center", gap: 20, marginBottom: 24 },
  scoreRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreInner: {
    width: 134,
    height: 134,
    borderRadius: 67,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  scoreNum: { fontSize: 42, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  scoreLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  scoreTextBlock: { alignItems: "center", gap: 8 },
  matchTitle: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  matchSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  pointsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    gap: 14,
    marginBottom: 20,
  },
  pointsTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  points: { gap: 12 },
  pointRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  pointIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pointLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
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
  secondaryBtn: { height: 52, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
