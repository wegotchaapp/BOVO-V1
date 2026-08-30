/**
 * A printable ticket: paper silhouette with cut corners, a pair of side
 * notches marking the stub tear line, and a dashed perforation.
 *
 * React Native has no clip-path, so the silhouette that the web version cuts
 * with a polygon is drawn here as an SVG path filled with the paper colour and
 * laid under the content. The geometry is the same polygon, point for point.
 *
 * The web version tilts toward the cursor on hover. Phones have no hover, so
 * the same motion is driven by touch instead — identical 6° limit, 1.018 lift
 * and cubic-bezier(0.23, 1, 0.32, 1) easing.
 */
import React, { useState } from "react";
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";

/** Matches the web component's transitionEasing. */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const TILT_DURATION = 220;
const TILT_MAX_DEG = 6;
const TILT_SCALE = 1.018;

export interface TicketProps {
  body: React.ReactNode;
  stub: React.ReactNode;
  /** Radius of the four cut corners, in px. */
  cornerSize?: number;
  /** Foreground colour used by ticket content. */
  ink?: string;
  /** Depth of the two side notches at the tear line, in px. */
  notchSize?: number;
  /** Ticket background colour. */
  paper?: string;
  /** Stub height as a fraction of total height (0–1). */
  stubHeight?: number;
  style?: ViewStyle;
  /** Tilt toward the touch point. */
  tilt?: boolean;
  /** Ticket width in px; height follows the 5:12 aspect. */
  width?: number;
}

/**
 * The same polygon the web version passes to clip-path, as an SVG path:
 * cut corners, then a notch biting into each side at the tear line.
 */
function silhouette(w: number, h: number, c: number, n: number, s: number) {
  const tear = h - s;
  return [
    `M 0 ${c}`,
    `L ${c} 0`,
    `L ${w - c} 0`,
    `L ${w} ${c}`,
    `L ${w} ${tear - n}`,
    `L ${w - n} ${tear}`,
    `L ${w} ${tear + n}`,
    `L ${w} ${h - c}`,
    `L ${w - c} ${h}`,
    `L ${c} ${h}`,
    `L 0 ${h - c}`,
    `L 0 ${tear + n}`,
    `L ${n} ${tear}`,
    `L 0 ${tear - n}`,
    "Z",
  ].join(" ");
}

export function Ticket({
  body,
  stub,
  cornerSize = 0,
  ink = "#111210",
  notchSize = 13,
  paper = "#C4954A",
  stubHeight = 0.24,
  style,
  tilt = true,
  width,
}: TicketProps) {
  const [size, setSize] = useState({ width: width ?? 0, height: 0 });

  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const scale = useSharedValue(1);

  function onLayout(e: LayoutChangeEvent) {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w !== size.width || h !== size.height) setSize({ width: w, height: h });
  }

  function applyTilt(e: GestureResponderEvent) {
    if (!tilt || !size.width || !size.height) return;
    const { locationX, locationY } = e.nativeEvent;
    // -1..1 from centre, then scaled to the max angle. Y drives rotateX so the
    // ticket leans away from the touch, matching the web's cursor behaviour.
    const px = (locationX / size.width) * 2 - 1;
    const py = (locationY / size.height) * 2 - 1;
    rotateY.value = withTiming(px * TILT_MAX_DEG, {
      duration: TILT_DURATION,
      easing: EASE_OUT,
    });
    rotateX.value = withTiming(-py * TILT_MAX_DEG, {
      duration: TILT_DURATION,
      easing: EASE_OUT,
    });
    scale.value = withTiming(TILT_SCALE, {
      duration: TILT_DURATION,
      easing: EASE_OUT,
    });
  }

  function resetTilt() {
    const t = { duration: TILT_DURATION, easing: EASE_OUT };
    rotateX.value = withTiming(0, t);
    rotateY.value = withTiming(0, t);
    scale.value = withTiming(1, t);
  }

  const tiltStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1100 },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
      { scale: scale.value },
    ],
  }));

  const { width: w, height: h } = size;
  const ready = w > 0 && h > 0;
  const stubPx = h * stubHeight;
  const tearY = h - stubPx;

  return (
    <Animated.View
      onLayout={onLayout}
      onResponderMove={applyTilt}
      onResponderRelease={resetTilt}
      onResponderTerminate={resetTilt}
      onStartShouldSetResponder={() => tilt}
      onMoveShouldSetResponder={() => tilt}
      onResponderGrant={applyTilt}
      style={[styles.root, width ? { width } : null, tiltStyle, style]}
    >
      {ready ? (
        <Svg height={h} style={StyleSheet.absoluteFill} width={w}>
          <Defs>
            {/* The web's linear-gradient(145deg, white 10%, transparent 42%). */}
            <LinearGradient id="ticketSheen" x1="0" x2="0.82" y1="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.1} />
              <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path
            d={silhouette(w, h, cornerSize, notchSize, stubPx)}
            fill={paper}
          />
          <Path
            d={silhouette(w, h, cornerSize, notchSize, stubPx)}
            fill="url(#ticketSheen)"
          />
          {/* Perforation, inset to clear the notches. */}
          <Line
            stroke={ink}
            strokeDasharray="4 4"
            strokeOpacity={0.3}
            strokeWidth={1}
            x1={notchSize + 6}
            x2={w - notchSize - 6}
            y1={tearY}
            y2={tearY}
          />
        </Svg>
      ) : null}

      <View style={styles.content}>
        <View style={styles.body}>{body}</View>
        <View style={{ height: stubPx }}>{stub}</View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    aspectRatio: 5 / 12,
    maxWidth: 272,
    width: "100%",
  },
  content: {
    ...StyleSheet.absoluteFillObject,
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
});
