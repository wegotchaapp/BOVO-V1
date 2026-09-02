import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, FeDropShadow, Filter, Line, Path } from "react-native-svg";

import { GOLD_ON_DARK } from "@/constants/colors";

/**
 * A forest-paper adventure ticket.
 *
 * React Native has no `clip-path`, so the silhouette — rounded corners plus the two
 * notches that mark the stub tear — is a single SVG outline (see `silhouette`). Because
 * the shape is the fill, rather than the page colour faked over the top, the ticket keeps
 * its notches against any background, including mid-slide out of the printer.
 */

const PAPER = "#1B3D2F";
const INK = "#F8F7F3";
/** Cream stepped down for metadata. 6.55:1 on the forest paper. */
const MUTED = "#B9C2BB";

const CORNER = 12;
const NOTCH = 9;
/** Share of the height given to the stub, below the tear line. */
const STUB_RATIO = 0.26;

export const TICKET_ASPECT = 1.78;

/**
 * Breathing room around the paper so the drop shadow is not clipped by the SVG bounds.
 * The shadow is drawn by an SVG filter rather than a React Native `shadow*` style
 * because an RN shadow follows the View's rectangle and would ignore the stub notches.
 */
export const TICKET_SHADOW_PAD = 16;

/** Full box a ticket occupies, shadow padding included. Callers size the printer to this. */
export function ticketBox(paperWidth: number) {
  const paperHeight = Math.round(paperWidth * TICKET_ASPECT);
  return {
    paperWidth,
    paperHeight,
    boxWidth: paperWidth + TICKET_SHADOW_PAD * 2,
    boxHeight: paperHeight + TICKET_SHADOW_PAD * 2,
  };
}

export type TicketProps = {
  fromCity: string;
  toCity: string;
  /** Formatted as "05.09" — day and month, printed-ticket style. */
  date: string;
  /** Formatted as "08:30". */
  departs: string;
  voyager: string;
  seats: number;
  reference: string;
  width: number;
};

/**
 * One closed outline, drawn clockwise, with the stub notches described as inward arcs.
 *
 * An earlier version drew a rect plus a full circle on each edge and relied on
 * `fillRule="evenodd"` to punch the notch. That is wrong: the half of the circle lying
 * *outside* the rect is covered by exactly one subpath, so even-odd fills it — every
 * notch got its bite taken out AND grew a matching bump, reading as a two-tone disc.
 * Describing the arc as part of the outline has no such outside region.
 *
 * Both notch arcs use sweep-flag 0. On the right edge, travelling downward, that bows the
 * arc toward -x; on the left edge, travelling upward, toward +x. Both bow inward.
 */
function silhouette(w: number, h: number, tearY: number): string {
  const r = CORNER;
  const n = NOTCH;
  return [
    `M ${r} 0`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${tearY - n}`,
    `A ${n} ${n} 0 0 0 ${w} ${tearY + n}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${tearY + n}`,
    `A ${n} ${n} 0 0 0 0 ${tearY - n}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
}

/** A barcode is just bars of varying width — no library needed for a decorative one. */
const BAR_WIDTHS = [
  1, 2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 1, 3, 2, 1, 1, 2, 1, 4, 1, 2, 3, 1, 1, 2, 1,
  3, 1, 1, 2, 1, 3,
];

const DOT_OPACITY = [0.18, 0.26, 0.34, 0.5, 0.68, 0.9, 0.68, 0.5, 0.34];

function seatWord(seats: number): string {
  if (seats === 1) return "ONE";
  if (seats === 2) return "TWO";
  if (seats === 3) return "THREE";
  return String(seats);
}

export function Ticket({
  fromCity,
  toCity,
  date,
  departs,
  voyager,
  seats,
  reference,
  width,
}: TicketProps) {
  const { paperHeight: height, boxWidth, boxHeight } = ticketBox(width);
  const stubHeight = Math.round(height * STUB_RATIO);
  const tearY = height - stubHeight;
  const P = TICKET_SHADOW_PAD;

  return (
    <View
      style={{ width: boxWidth, height: boxHeight }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Ticket. ${fromCity} to ${toCity}, ${date} departing ${departs}. ${seats} seat${seats === 1 ? "" : "s"} with ${voyager}. Reference ${reference}.`}
    >
      <Svg
        style={StyleSheet.absoluteFill}
        width={boxWidth}
        height={boxHeight}
        viewBox={`0 0 ${boxWidth} ${boxHeight}`}
      >
        <Defs>
          {/* Lifts the paper off the page so it reads as having left the printer. */}
          <Filter id="lift" x="-25%" y="-25%" width="150%" height="150%">
            <FeDropShadow
              dx="0"
              dy="5"
              stdDeviation="5"
              floodColor="#1B3D2F"
              floodOpacity="0.30"
            />
          </Filter>
        </Defs>
        <Path
          d={silhouette(width, height, tearY)}
          fill={PAPER}
          filter="url(#lift)"
          translateX={P}
          translateY={P}
        />
        <Line
          x1={P + NOTCH + 6}
          y1={P + tearY}
          x2={P + width - NOTCH - 6}
          y2={P + tearY}
          stroke={INK}
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.32}
        />
      </Svg>

      <View style={[styles.body, { height: tearY, top: P, left: P, width }]}>
        <View style={styles.topRow}>
          <Text style={styles.kicker}>ADVENTURE</Text>
          <Text style={styles.kicker}>TEXAS · US</Text>
        </View>

        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: 5 }).map((_, row) => (
            <View key={row} style={styles.dotRow}>
              {DOT_OPACITY.map((base, col) => (
                <View
                  key={col}
                  style={[
                    styles.dot,
                    { opacity: Math.min(1, base + (row === 2 ? 0.18 : 0)) },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>

        <Text style={styles.route} numberOfLines={2}>
          {fromCity.toUpperCase()}
          {"\n→ "}
          {toCity.toUpperCase()}
        </Text>
        <Text style={styles.blurb} numberOfLines={2}>
          Your seat is held. Meet {voyager.split(" ")[0]} at the pickup point.
        </Text>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaKey}>DATE</Text>
            <Text style={styles.metaValue}>{date}</Text>
          </View>
          <View>
            <Text style={styles.metaKey}>DEPARTS</Text>
            <Text style={styles.metaValue}>{departs}</Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.stub,
          { height: stubHeight, top: P + tearY, left: P, width },
        ]}
      >
        <View style={styles.stubRow}>
          <View>
            <Text style={styles.metaKey}>SEAT</Text>
            <Text style={styles.metaValue}>{seatWord(seats)}</Text>
          </View>
          <View style={styles.stubRight}>
            <Text style={styles.metaKey}>REFERENCE</Text>
            <Text style={styles.reference}>{reference}</Text>
          </View>
        </View>
        <View style={styles.barcode} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {BAR_WIDTHS.map((w, i) => (
            <View key={i} style={[styles.bar, { width: w }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    position: "absolute",
    paddingHorizontal: 16,
    // Clears HIDDEN_BEHIND_MACHINE in TicketPrinter, so the kicker row is never
    // swallowed by the machine when the ticket is fully fed.
    paddingTop: 26,
    justifyContent: "flex-start",
  },
  topRow: { flexDirection: "row", justifyContent: "space-between" },
  kicker: {
    color: MUTED,
    fontSize: 7,
    letterSpacing: 1,
    fontFamily: "Inter_500Medium",
  },
  dots: { marginTop: 10, marginBottom: "auto", gap: 3 },
  dotRow: { flexDirection: "row", gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 1, backgroundColor: GOLD_ON_DARK },
  route: {
    color: INK,
    fontSize: 21,
    lineHeight: 23,
    letterSpacing: -0.4,
    fontFamily: "Inter_700Bold",
    marginTop: 12,
  },
  blurb: {
    color: MUTED,
    fontSize: 9,
    lineHeight: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 7,
  },
  metaRow: { flexDirection: "row", gap: 22, marginTop: 10, paddingBottom: 11 },
  metaKey: {
    color: MUTED,
    fontSize: 6.5,
    letterSpacing: 1.1,
    fontFamily: "Inter_500Medium",
    marginBottom: 2,
  },
  metaValue: { color: INK, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  stub: {
    position: "absolute",
    paddingHorizontal: 16,
    paddingTop: 12,
    justifyContent: "space-between",
    paddingBottom: 14,
  },
  stubRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  stubRight: { alignItems: "flex-end" },
  reference: { color: INK, fontSize: 9, fontFamily: "Inter_600SemiBold" },
  barcode: { flexDirection: "row", alignItems: "flex-end", gap: 1.5, height: 22 },
  bar: { height: "100%", backgroundColor: INK, borderRadius: 0.5 },
});
