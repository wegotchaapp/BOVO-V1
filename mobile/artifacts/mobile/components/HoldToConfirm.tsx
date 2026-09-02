import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

export type HoldTone = "primary" | "destructive";

export type HoldToConfirmProps = {
  label: string;
  /** Shown briefly after the hold completes. */
  confirmedLabel?: string;
  onConfirm: () => void;
  /** How long the finger has to stay down. */
  duration?: number;
  disabled?: boolean;
  /** Replaces the label entirely while work is in flight. */
  busy?: boolean;
  busyLabel?: string;
  tone?: HoldTone;
  icon?: keyof typeof Feather.glyphMap;
  style?: ViewStyle;
};

/**
 * A button that only fires once it has been held down.
 *
 * The web original clips a filled copy of the label with `clip-path: inset()`.
 * React Native has no clip-path, so the same effect comes from an absolutely
 * positioned overlay whose *width* animates while a full-width label sits inside
 * it — the parent clips with `overflow: "hidden"`, so the text is revealed rather
 * than squashed. That needs the measured width, hence the onLayout.
 *
 * The fill keeps animating under Reduce Motion. It is not decoration: it is the
 * only signal of how much longer to hold, and removing it would leave the control
 * unusable rather than calmer.
 */
export function HoldToConfirm({
  label,
  confirmedLabel,
  onConfirm,
  duration = 1400,
  disabled = false,
  busy = false,
  busyLabel,
  tone = "primary",
  icon,
  style,
}: HoldToConfirmProps) {
  const colors = useColors();
  const progress = useSharedValue(0);
  /**
   * The measured width lives in a shared value, not React state. An animated style
   * that closes over state can keep the value it saw on first render — which here
   * is 0 — leaving the fill stuck at `progress * 0` while the timer runs happily.
   */
  const trackWidth = useSharedValue(0);
  const [width, setWidth] = useState(0);
  const [holding, setHolding] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceMotion.current = v;
    });
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const finish = useCallback(() => {
    setHolding(false);
    setConfirmed(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }
    onConfirm();
    resetTimer.current = setTimeout(() => {
      setConfirmed(false);
      progress.value = 0;
    }, 1200);
  }, [onConfirm, progress]);

  function start() {
    if (disabled || busy || confirmed) return;
    setHolding(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    progress.value = withTiming(
      1,
      { duration, easing: Easing.linear },
      (done) => {
        if (done) runOnJS(finish)();
      },
    );
  }

  function abort() {
    if (confirmed) return;
    cancelAnimation(progress);
    setHolding(false);
    // Springing back rather than snapping makes a slip feel recoverable.
    progress.value = withTiming(0, { duration: 180 });
  }

  const fillStyle = useAnimatedStyle(() => ({
    width: progress.value * trackWidth.value,
  }));

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    trackWidth.value = w;
    setWidth(w);
  }

  const base = tone === "destructive" ? colors.destructive : colors.primary;
  const restBg = tone === "destructive" ? "#FDECEA" : colors.secondary;
  const restInk = tone === "destructive" ? colors.destructive : colors.primary;
  const isDim = disabled && !busy;

  const content = (ink: string) => (
    <View style={styles.row}>
      {icon ? <Feather name={icon} size={16} color={ink} /> : null}
      <Text style={[styles.label, { color: ink }]} numberOfLines={1}>
        {busy ? (busyLabel ?? label) : confirmed ? (confirmedLabel ?? label) : label}
      </Text>
    </View>
  );

  return (
    <Pressable
      onLayout={onLayout}
      onPressIn={start}
      onPressOut={abort}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Press and hold to confirm"
      accessibilityState={{ disabled: disabled || busy, busy: holding }}
      style={[
        styles.btn,
        {
          backgroundColor: confirmed ? base : restBg,
          opacity: isDim ? 0.55 : 1,
        },
        style,
      ]}
    >
      {/* Resting label. */}
      {content(confirmed ? "#fff" : isDim ? colors.mutedForeground : restInk)}

      {/* The filled copy, revealed left to right as the hold progresses. */}
      {!confirmed ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: base }, fillStyle]}
        >
          <View style={[styles.fillInner, { width: width || undefined }]}>
            {content("#fff")}
          </View>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    overflow: "hidden",
  },
  /** Full button width inside the clipped fill, so the text does not compress. */
  fillInner: {
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
