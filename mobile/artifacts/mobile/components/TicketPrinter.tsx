import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { TICKET_SHADOW_PAD } from "@/components/Ticket";

export type PrinterStage = "processing" | "printing" | "complete";
export type FeedMotion = "smooth" | "stepped";

/** How long the paper takes to feed out. The parent uses this to time its stage flip. */
export const PRINT_DURATION_MS = 1750;

/** How much opaque paper stays hidden behind the machine once fully fed. */
const HIDDEN_BEHIND_MACHINE = 22;

/**
 * How far the output window is pulled up under the machine. The ticket box carries
 * `TICKET_SHADOW_PAD` of transparent padding above the paper, so that has to be added on
 * top of the overlap we actually want — otherwise the paper's edge lands flush with the
 * machine and reads as a separate card sitting below it rather than paper coming out of it.
 */
const TUCK = TICKET_SHADOW_PAD + HIDDEN_BEHIND_MACHINE;

const BODY = "#EEEAE3";
const BODY_EDGE = "#E3DDD3";
const SCREEN = "#1B3D2F";
const SCREEN_INK = "#F8F7F3";
const SCREEN_MUTED = "#B9C2BB";
const SLOT = "#4A574E";

const STATUS_LABEL: Record<PrinterStage, string> = {
  processing: "Confirming your seat",
  printing: "Printing your ticket",
  complete: "You're on board",
};

export type TicketPrinterProps = {
  stage: PrinterStage;
  /** Shown on the printer's screen, e.g. "Dallas → Austin". */
  title: string;
  /** Secondary screen line, e.g. "1 seat · Fri, Sep 5". */
  subtitle: string;
  /** Right-aligned total, already formatted. */
  total: string;
  /** The ticket that feeds out of the slot. */
  children: React.ReactNode;
  /** Full box height of the ticket, shadow padding included, so the window clips right. */
  ticketHeight: number;
  /** Continuous feed, or one line at a time. */
  feedMotion?: FeedMotion;
};

/**
 * A ticket printer. The machine is warm cream so the forest ticket reads against it —
 * the inverse of the usual dark-printer/white-receipt pairing, chosen because a forest
 * ticket emerging from a dark body would disappear into it.
 *
 * The paper feed uses `Easing.steps`, which gives the one-line-at-a-time judder of a real
 * thermal printer in a single timing call.
 */
export function TicketPrinter({
  stage,
  title,
  subtitle,
  total,
  children,
  ticketHeight,
  feedMotion = "smooth",
}: TicketPrinterProps) {
  const feed = useSharedValue(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (stage === "processing") {
      feed.value = 0;
      return;
    }
    if (stage === "printing") {
      feed.value = reduceMotion
        ? withTiming(1, { duration: 220 })
        : withTiming(1, {
            duration: PRINT_DURATION_MS,
            easing:
              feedMotion === "stepped"
                ? Easing.steps(9, true)
                : // Continuous feed: eases in, runs, settles. Matches the reference.
                  Easing.bezier(0.77, 0, 0.175, 1),
          });
      return;
    }
    feed.value = 1;
  }, [stage, reduceMotion, feedMotion]);

  const paperStyle = useAnimatedStyle(() => ({
    opacity: feed.value === 0 ? 0 : 1,
    transform: [
      { translateY: interpolate(feed.value, [0, 1], [-ticketHeight, 0]) },
    ],
  }));

  const working = stage !== "complete";

  return (
    <View style={styles.root}>
      <View style={styles.machine}>
        <View style={styles.header}>
          <View style={styles.mark}>
            <Feather name="navigation" size={13} color={SCREEN} />
          </View>
          <Text style={styles.headerLabel}>BOVOGO</Text>
        </View>

        <View style={styles.screen}>
          <View style={styles.screenRow}>
            <View style={styles.screenLeft}>
              <Text style={styles.screenTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.screenSub} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            <View style={styles.screenRight}>
              <Text style={styles.screenKey}>TOTAL</Text>
              <Text style={styles.screenTotal}>{total}</Text>
            </View>
          </View>

          <View style={styles.statusRow} accessibilityLiveRegion="polite">
            {working ? (
              <ActivityIndicator size="small" color={SCREEN_MUTED} />
            ) : (
              <Feather name="check-circle" size={16} color="#7FC79B" />
            )}
            <Text style={styles.statusText}>{STATUS_LABEL[stage]}</Text>
          </View>
        </View>

        <View style={styles.slot} />
      </View>

      <View style={[styles.output, { height: ticketHeight }]}>
        <Animated.View style={paperStyle}>{children}</Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", width: "100%" },
  machine: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    backgroundColor: BODY,
    borderWidth: 1,
    borderColor: BODY_EDGE,
    padding: 12,
    paddingBottom: 8,
    zIndex: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#E3DDD3",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: "#67736A",
    fontFamily: "Inter_600SemiBold",
  },
  screen: {
    borderRadius: 16,
    backgroundColor: SCREEN,
    padding: 12,
  },
  screenRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  screenLeft: { flex: 1, paddingRight: 12 },
  screenRight: { alignItems: "flex-end" },
  screenTitle: { color: SCREEN_INK, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  screenSub: { color: SCREEN_MUTED, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  screenKey: { color: SCREEN_MUTED, fontSize: 9, letterSpacing: 0.8, fontFamily: "Inter_500Medium" },
  screenTotal: { color: SCREEN_INK, fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  statusText: { color: SCREEN_MUTED, fontSize: 12, fontFamily: "Inter_500Medium" },
  slot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: SLOT,
    marginTop: 10,
    marginHorizontal: 8,
  },
  /**
   * Clips the paper. Pulled up by TUCK so the paper's top edge starts behind the machine
   * — the machine has the higher zIndex — and emerges from under its bottom lip rather
   * than materialising in the gap below it.
   */
  output: {
    width: "100%",
    maxWidth: 320,
    overflow: "hidden",
    alignItems: "center",
    marginTop: -TUCK,
    zIndex: 1,
  },
});
