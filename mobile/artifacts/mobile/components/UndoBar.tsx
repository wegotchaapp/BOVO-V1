import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const FOREST = "#1B3D2F";
const INK = "#F8F7F3";
/** Cream stepped down for the countdown track. 6.55:1 on forest. */
const MUTED = "#B9C2BB";

export type UndoBarProps = {
  visible: boolean;
  message: string;
  /** Called when the window closes without the user undoing. */
  onExpire: () => void;
  onUndo: () => void;
  /** How long the offer stands. */
  duration?: number;
};

/**
 * A short window in which the last action can be taken back.
 *
 * Pairs with HoldToConfirm: the hold stops an action happening by accident, and
 * this catches the case where it was deliberate but wrong. The bar shows the time
 * remaining rather than vanishing without warning, so the choice is visible.
 */
export function UndoBar({
  visible,
  message,
  onExpire,
  onUndo,
  duration = 6000,
}: UndoBarProps) {
  const remaining = useSharedValue(1);
  const [mounted, setMounted] = useState(visible);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      remaining.value = 1;
      remaining.value = withTiming(0, {
        duration,
        easing: Easing.linear,
      });
      timer.current = setTimeout(onExpire, duration);
    } else {
      setMounted(false);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // onExpire is intentionally not a dependency: re-running this on every parent
    // render would restart the countdown and the window would never close.
  }, [visible, duration, remaining]);

  const trackStyle = useAnimatedStyle(() => ({
    flex: Math.max(remaining.value, 0.0001),
  }));

  if (!mounted) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={styles.row}>
          <Feather name="check-circle" size={16} color="#7FC79B" />
          <Text style={styles.message} numberOfLines={1}>
            {message}
          </Text>
          <Pressable
            onPress={() => {
              if (timer.current) clearTimeout(timer.current);
              onUndo();
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Undo"
            style={styles.undoBtn}
          >
            <Text style={styles.undoText}>Undo</Text>
          </Pressable>
        </View>

        {/* The time left, shown rather than implied. */}
        <View style={styles.track}>
          <Animated.View style={[styles.trackFill, trackStyle]} />
          <View style={styles.trackRest} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: Platform.OS === "web" ? 24 : 34,
    zIndex: 50,
  },
  bar: {
    backgroundColor: FOREST,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
    shadowColor: FOREST,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  message: { flex: 1, color: INK, fontSize: 14, fontFamily: "Inter_500Medium" },
  undoBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  undoText: { color: "#D9AF6A", fontSize: 14, fontFamily: "Inter_700Bold" },
  track: { flexDirection: "row", height: 3, borderRadius: 2, overflow: "hidden" },
  trackFill: { backgroundColor: MUTED },
  trackRest: { flex: 0.0001 },
});
