/**
 * A thermal printer that feeds a ticket out of its slot.
 *
 * Ported from the web component. Two things had to change shape for React
 * Native, and neither changes what you see:
 *
 *  - The paper feed is a CSS keyframe list on the web. Here the same 20
 *    keyframes and their 20 timing stops drive a single 0→1 progress value
 *    through `interpolate`, so the ratchet — advance, hold, advance — lands on
 *    exactly the same frames over the same 1.75s.
 *  - The torn bottom edge is a clip-path polygon on the web. React Native has
 *    no clip-path, so the teeth are drawn as an SVG sawtooth in the paper
 *    colour sitting under the sheet.
 *
 * The machine is deliberately dark in both colour schemes, the way a real one
 * is. Its greens come from the Bovogo forest palette rather than neutral grey.
 */
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Polygon } from "react-native-svg";

export type ReceiptPrinterStage = "processing" | "printing" | "complete";
export type ReceiptFeedMotion = "smooth" | "stepped";

/** Bovogo forest, dark end. The device reads as hardware, not as app chrome. */
const PRINTER = {
  body: "#1E2C26",
  border: "#2E3B35",
  screen: "#12211B",
  screenBorder: "#0D1713",
  slot: "#0D1713",
  ink: "#F8F7F3",
  inkSoft: "#8A9A8D",
  good: "#589D79",
} as const;

const RADIUS = 24;
const INSET = 12;
const INNER_RADIUS = RADIUS - INSET;
const FEED_DURATION = 1750;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

/**
 * Percentage of the sheet's own height, from fully retracted to fully fed.
 * Repeated values are the holds between steps — that pause is the ratchet.
 */
const FEED_KEYFRAMES = [
  -100, -91, -91, -81, -81, -70, -70, -58, -58, -45, -45, -32, -32, -20, -20,
  -10, -10, -3, -3, 0,
];

const FEED_TIMES = [
  0, 0.075, 0.105, 0.18, 0.21, 0.285, 0.315, 0.39, 0.42, 0.495, 0.525, 0.6,
  0.63, 0.705, 0.735, 0.81, 0.84, 0.915, 0.945, 1,
];

const STATUS_LABELS: Record<ReceiptPrinterStage, string> = {
  processing: "Processing your booking",
  printing: "Printing your ticket",
  complete: "Booking complete",
};

interface PrinterContextValue {
  animate: boolean;
  feedMotion: ReceiptFeedMotion;
  stage: ReceiptPrinterStage;
}

const PrinterContext = createContext<PrinterContextValue | null>(null);

function usePrinter(component: string): PrinterContextValue {
  const ctx = useContext(PrinterContext);
  if (!ctx)
    throw new Error(`${component} must be used inside ReceiptPrinter.Root.`);
  return ctx;
}

export interface ReceiptPrinterRootProps {
  children: React.ReactNode;
  /** Disables every stage transition when false. */
  animate?: boolean;
  /** Continuous feed, or one line at a time. */
  feedMotion?: ReceiptFeedMotion;
  stage: ReceiptPrinterStage;
  style?: ViewStyle;
}

function Root({
  children,
  animate = true,
  feedMotion = "stepped",
  stage,
  style,
}: ReceiptPrinterRootProps) {
  return (
    <PrinterContext.Provider value={{ animate, feedMotion, stage }}>
      <View accessibilityLabel="Ticket printer" style={[styles.root, style]}>
        {children}
      </View>
    </PrinterContext.Provider>
  );
}

function Machine({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.machine, style]}>
      {children}
      {/* The slot the paper comes out of. */}
      <View style={styles.slot} />
    </View>
  );
}

function Header({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.header, style]}>{children}</View>;
}

function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

/** Spinner while working, green check once complete. */
function StatusIndicator({
  animate,
  stage,
}: {
  animate: boolean;
  stage: ReceiptPrinterStage;
}) {
  const spin = useSharedValue(0);
  const isComplete = stage === "complete";

  useEffect(() => {
    if (isComplete || !animate) {
      spin.value = 0;
      return;
    }
    spin.value = 0;
    spin.value = withRepeat(
      withTiming(360, { duration: 1000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [animate, isComplete, spin]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  if (isComplete) {
    return (
      <View style={styles.indicator}>
        <Feather color={PRINTER.good} name="check-circle" size={18} />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.indicator, spinStyle]}>
      <Feather color={PRINTER.inkSoft} name="loader" size={18} />
    </Animated.View>
  );
}

function Status({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { animate, stage } = usePrinter("ReceiptPrinter.Status");
  const opacity = useSharedValue(1);
  const lift = useSharedValue(0);

  // Each stage change re-enters the label: up 4px and fade, as on the web.
  useEffect(() => {
    if (!animate) {
      opacity.value = 1;
      lift.value = 0;
      return;
    }
    opacity.value = 0;
    lift.value = 4;
    opacity.value = withTiming(1, { duration: 180, easing: EASE_OUT });
    lift.value = withTiming(0, { duration: 180, easing: EASE_OUT });
  }, [animate, lift, opacity, stage]);

  const labelStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: lift.value }],
  }));

  return (
    <View style={[styles.status, style]}>
      <StatusIndicator animate={animate} stage={stage} />
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="text"
        style={[styles.statusLabelWrap, labelStyle]}
      >
        {typeof children === "string" || children === undefined ? (
          <Text numberOfLines={1} style={styles.statusLabel}>
            {children ?? STATUS_LABELS[stage]}
          </Text>
        ) : (
          children
        )}
      </Animated.View>
    </View>
  );
}

/**
 * The window the paper feeds through. Clips the sheet so it appears to come
 * out of the machine rather than sliding in front of it.
 */
function Output({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { animate, feedMotion, stage } = usePrinter("ReceiptPrinter.Output");
  const [sheetHeight, setSheetHeight] = useState(0);

  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  const isVisible = stage !== "processing";
  const stepped = feedMotion === "stepped" && animate;

  useEffect(() => {
    opacity.value = withTiming(isVisible ? 1 : 0, {
      duration: animate ? 160 : 0,
      easing: EASE_OUT,
    });
  }, [animate, isVisible, opacity]);

  useEffect(() => {
    if (stage === "processing") {
      progress.value = 0;
      return;
    }
    if (stage === "complete" || !animate) {
      progress.value = 1;
      return;
    }
    // printing
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: FEED_DURATION,
      easing: stepped ? Easing.linear : EASE_IN_OUT,
    });
  }, [animate, progress, stage, stepped]);

  function onSheetLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    if (h && h !== sheetHeight) setSheetHeight(h);
  }

  // Keyframes are a share of the sheet's own height, so they need it in px.
  // The first stop keeps a 2px sliver at the lip, exactly as the web does.
  const outputs = FEED_KEYFRAMES.map((pct) => (pct / 100) * sheetHeight);
  if (outputs.length) outputs[0] = -sheetHeight + 2;

  const sheetStyle = useAnimatedStyle(() => {
    if (!sheetHeight) return { opacity: opacity.value };
    const translateY = stepped
      ? interpolate(progress.value, FEED_TIMES, outputs)
      : interpolate(progress.value, [0, 1], [outputs[0], 0]);
    return { opacity: opacity.value, transform: [{ translateY }] };
  });

  return (
    <View style={[styles.output, style]}>
      <Animated.View
        onLayout={onSheetLayout}
        style={[styles.sheet, sheetStyle]}
        testID="printer-sheet"
      >
        {children}
      </Animated.View>

      {/* Shadow the machine casts onto the emerging sheet. */}
      {isVisible ? (
        <LinearGradient
          colors={["rgba(13,23,19,0.75)", "rgba(13,23,19,0)"]}
          pointerEvents="none"
          style={styles.slotShadow}
        />
      ) : null}
    </View>
  );
}

const TOOTH_COUNT = 40;
const TOOTH_DEPTH = 4;

/** Receipt stock with a torn bottom edge, for when a plain receipt is wanted. */
function Paper({
  children,
  color = "#F8F7F3",
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: ViewStyle;
}) {
  const [width, setWidth] = useState(0);

  // Sawtooth across the full width; every other point rises by the tooth depth.
  const points = Array.from({ length: TOOTH_COUNT * 2 + 1 }, (_, i) => {
    const x = (i * width) / (TOOTH_COUNT * 2);
    const y = i % 2 === 0 ? 0 : TOOTH_DEPTH;
    return `${x},${y}`;
  }).join(" ");

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={[styles.paper, { backgroundColor: color }, style]}>
        {children}
      </View>
      {width > 0 ? (
        <Svg height={TOOTH_DEPTH} width={width}>
          <Polygon fill={color} points={`0,0 ${points} ${width},0`} />
        </Svg>
      ) : null}
    </View>
  );
}

export const ReceiptPrinter = {
  Header,
  Machine,
  Output,
  Paper,
  Root,
  Screen,
  Status,
};

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    alignSelf: "center",
    maxWidth: 384,
    width: "100%",
  },
  machine: {
    backgroundColor: PRINTER.body,
    borderColor: PRINTER.border,
    borderRadius: RADIUS,
    borderWidth: 1,
    overflow: "hidden",
    padding: INSET,
    paddingBottom: 32,
    width: "100%",
    zIndex: 10,
    shadowColor: "#0D1713",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.42,
    shadowRadius: 26,
    elevation: 10,
  },
  slot: {
    backgroundColor: PRINTER.slot,
    borderRadius: 4,
    bottom: INSET,
    height: 8,
    left: 24,
    position: "absolute",
    right: 24,
    zIndex: 40,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    height: 44,
    justifyContent: "space-between",
  },
  screen: {
    backgroundColor: PRINTER.screen,
    borderColor: PRINTER.screenBorder,
    borderRadius: INNER_RADIUS,
    borderWidth: 1,
    overflow: "hidden",
    padding: 16,
  },
  status: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  indicator: {
    alignItems: "center",
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  statusLabelWrap: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  statusLabel: {
    color: PRINTER.inkSoft,
    fontSize: 12,
    fontWeight: "500",
  },
  output: {
    alignItems: "center",
    marginTop: -16,
    overflow: "hidden",
    paddingHorizontal: 24,
    width: "100%",
  },
  sheet: {
    alignItems: "center",
    width: "100%",
  },
  slotShadow: {
    height: 8,
    left: 24,
    position: "absolute",
    right: 24,
    // Sits at the machine's lip: Output is pulled 16px up under the casing.
    top: 16,
    zIndex: 20,
  },
  paper: {
    paddingBottom: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
});
