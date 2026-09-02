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

import { useAsyncResource } from "@/hooks/useAsyncResource";
import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";
import { getTrip } from "@/lib/trips";
import { getMyPreferences } from "@/lib/preferences";
import type { Trip } from "@/data/trips";

interface MatchPoint {
  icon: string;
  label: string;
  match: boolean;
}

/**
 * Only four preferences exist on both sides — an adventure carries smoking, pets,
 * music and ac, and the Sailor answers the same four (plus talk and food, which a
 * Voyager never states, so they are left out rather than guessed at).
 *
 * A Sailor's answer is only capable of clashing when it is a firm one. "Love to
 * chat" or "Anything goes" tolerates whatever the Voyager set, so it always
 * matches; "No pets" does not.
 */
function comparePreferences(
  trip: Trip,
  answers: Record<string, string>,
): MatchPoint[] {
  const p = trip.preferences;
  const points: MatchPoint[] = [];

  if (answers.smoke) {
    const wantsSmokeFree = answers.smoke === "No, never";
    points.push({
      icon: "wind",
      label: p.smoking ? "Smoking allowed" : "Non-smoking",
      match: !wantsSmokeFree || !p.smoking,
    });
  }
  if (answers.music) {
    const wantsSilence = answers.music === "Silence is golden";
    points.push({
      icon: "music",
      label: p.music ? "Music on" : "Quiet cabin",
      match: !wantsSilence || !p.music,
    });
  }
  if (answers.pets) {
    const wantsNoPets = answers.pets === "No pets";
    points.push({
      icon: "heart",
      label: p.pets ? "Pets welcome" : "No pets",
      match: !wantsNoPets || !p.pets,
    });
  }
  if (answers.ac) {
    const wantsAc = answers.ac === "Always on";
    points.push({
      icon: "thermometer",
      label: p.ac ? "AC on" : "AC off",
      match: !wantsAc || p.ac,
    });
  }
  return points;
}

export default function Matching() {
  const colors = useColors();
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();

  /**
   * "Could not load the adventure" and "you have not set any preferences" used
   * to collapse into one null, so a dropped request told the Sailor to set
   * preferences they may already have set — and setting them changed nothing,
   * because the trip was what failed. The hook keeps the two apart by
   * construction.
   */
  const match = useAsyncResource(
    async () => {
      const [t, prefs] = await Promise.all([
        getTrip(tripId!).then((r) => r.trip),
        // Preferences are a nicety: never having set any is a real, expected
        // state, and must not read as a failed load.
        getMyPreferences().then((r) => r.preferences).catch(() => ({})),
      ]);
      return { trip: t, points: comparePreferences(t, prefs ?? {}) };
    },
    { deps: [tripId], enabled: Boolean(tripId) },
  );

  const trip = match.data?.trip ?? null;
  const points = match.data?.points ?? null;
  const loading = match.phase === "loading";
  const loadFailed = match.phase === "failed";

  const scoreScale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(24);

  useEffect(() => {
    scoreScale.value = withDelay(300, withSpring(1, { damping: 14, stiffness: 80 }));
    opacity.value = withDelay(200, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(200, withSpring(0, { damping: 15 }));
  }, []);

  const scored = points && points.length > 0;
  const matched = points?.filter((p) => p.match).length ?? 0;
  const score = scored ? Math.round((matched / points!.length) * 100) : null;
  const voyagerFirstName = trip?.driver?.name?.split(" ")[0] ?? "your Voyager";

  function verdict(): string {
    if (loadFailed) return "Couldn't load this adventure";
    if (score === null) return "Set your preferences";
    if (score === 100) return "Everything lines up";
    if (score >= 60) return "Mostly a good fit";
    return "A few differences";
  }

  function verdictSub(): string {
    if (loadFailed) {
      return "Check your connection and pull to try again — your preferences are fine.";
    }
    if (score === null) {
      return "Answer a few questions about how you like to travel and we'll compare them with each adventure.";
    }
    return score === 100
      ? `You and ${voyagerFirstName} want the same things on the road.`
      : `${matched} of ${points!.length} of your preferences match ${voyagerFirstName}'s.`;
  }

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
              <Text style={[styles.scoreNum, { color: colors.primary }]}>
                {loading ? "…" : score === null ? "—" : `${score}%`}
              </Text>
              <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>Match</Text>
            </View>
          </Animated.View>

          <Animated.View style={[styles.scoreTextBlock, contentStyle]}>
            <Text style={[styles.matchTitle, { color: colors.foreground }]}>
              {loading ? "Comparing…" : verdict()}
            </Text>
            <Text style={[styles.matchSub, { color: colors.mutedForeground }]}>
              {loading ? "" : verdictSub()}
            </Text>
          </Animated.View>
        </View>

        {scored ? (
        <Animated.View style={[styles.pointsCard, CARD_SHADOW, contentStyle]}>
          <Text style={[styles.pointsTitle, { color: colors.foreground }]}>Compatibility Details</Text>
          <View style={styles.points}>
            {(points ?? []).map((p) => (
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
        ) : null}

        {/* Unscored, this screen asks you to set your preferences and used to
            offer no way to do it — the only buttons were pay and browse away.
            Preferences stay optional, so payment is still one tap. */}
        <Animated.View style={[styles.actions, contentStyle]}>
          {scored ? (
            <>
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
                  Browse other adventures
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/preferences" as any)}
                activeOpacity={0.88}
              >
                <Text style={styles.primaryBtnText}>Set your preferences</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryBtn, { backgroundColor: colors.secondary }]}
                onPress={() =>
                  router.push({ pathname: "/payment", params: tripId ? { tripId } : {} })
                }
                activeOpacity={0.88}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>
                  Continue to Payment
                </Text>
              </TouchableOpacity>
            </>
          )}
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
