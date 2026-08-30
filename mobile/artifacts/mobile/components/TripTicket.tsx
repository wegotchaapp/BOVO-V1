/**
 * The ticket that comes out of the printer: a Bovogo seat on a trip.
 *
 * Every field defaults to the sample values used to tune the print animation.
 * Passing real booking data in is a prop swap — nothing else has to change.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { Ticket } from "@/components/Ticket";

/** Bovogo gold on near-black — the accent already used across the app. */
const PAPER = "#C4954A";
const INK = "#171714";

export interface TripTicketProps {
  code?: string;
  date?: string;
  from?: string;
  fromCity?: string;
  price?: string;
  seat?: string;
  time?: string;
  to?: string;
  toCity?: string;
  voyager?: string;
  width?: number;
}

/**
 * Deterministic bar widths from the booking code, so a given ticket always
 * renders the same barcode.
 */
function bars(code: string, count: number): number[] {
  let seed = 0;
  for (let i = 0; i < code.length; i += 1) {
    seed = (seed * 31 + code.charCodeAt(i)) % 100_000;
  }
  return Array.from({ length: count }, (_, i) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return ((seed >> (i % 8)) % 3) + 1;
  });
}

function Barcode({ code, width }: { code: string; width: number }) {
  const widths = bars(code, 44);
  const unit = width / widths.reduce((sum, w) => sum + w + 1, 0);
  let x = 0;

  return (
    <Svg height={34} width={width}>
      {widths.map((w, i) => {
        const barX = x;
        x += (w + 1) * unit;
        return i % 2 === 0 ? (
          <Rect
            fill={INK}
            height={34}
            key={`${barX}-${i}`}
            width={w * unit}
            x={barX}
            y={0}
          />
        ) : null;
      })}
    </Svg>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.fieldValue}>
        {value}
      </Text>
    </View>
  );
}

export function TripTicket({
  code = "BVG-2048",
  date = "11 AUG 2026",
  from = "AUS",
  fromCity = "Austin",
  price = "$38.40",
  seat = "1",
  time = "14:32",
  to = "HOU",
  toCity = "Houston",
  voyager = "Marcus R.",
  width,
}: TripTicketProps) {
  return (
    <Ticket
      body={
        <View style={styles.body}>
          <View>
            <View style={styles.brandRow}>
              <Text style={styles.brand}>BOVOGO</Text>
              <Text style={styles.brandMark}>◆</Text>
            </View>

            <View style={styles.routeRow}>
              <View>
                <Text style={styles.code}>{from}</Text>
                <Text style={styles.city}>{fromCity}</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
              <View style={styles.routeEnd}>
                <Text style={styles.code}>{to}</Text>
                <Text style={styles.city}>{toCity}</Text>
              </View>
            </View>
          </View>

          <View>
            <View style={styles.fields}>
              <Field label="DATE" value={date} />
              <Field label="DEPARTS" value={time} />
              <Field label="SEAT" value={seat} />
              <Field label="VOYAGER" value={voyager} />
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL PAID</Text>
              <Text style={styles.totalValue}>{price}</Text>
            </View>
          </View>
        </View>
      }
      ink={INK}
      paper={PAPER}
      stub={
        <View style={styles.stub}>
          <Barcode code={code} width={168} />
          <Text style={styles.stubCode}>{code}</Text>
        </View>
      }
      width={width}
    />
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  brand: {
    color: INK,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2.5,
  },
  brandMark: {
    color: INK,
    fontSize: 12,
    opacity: 0.55,
  },
  routeRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  routeEnd: {
    alignItems: "flex-end",
  },
  code: {
    color: INK,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  city: {
    color: INK,
    fontSize: 10,
    letterSpacing: 0.6,
    opacity: 0.6,
  },
  arrow: {
    color: INK,
    fontSize: 16,
    opacity: 0.5,
  },
  fields: {
    gap: 9,
  },
  field: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fieldLabel: {
    color: INK,
    fontSize: 9,
    letterSpacing: 1,
    opacity: 0.55,
  },
  fieldValue: {
    color: INK,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 12,
  },
  totalRow: {
    alignItems: "baseline",
    borderTopColor: INK,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 10,
  },
  totalLabel: {
    color: INK,
    fontSize: 9,
    letterSpacing: 1,
    opacity: 0.6,
  },
  totalValue: {
    color: INK,
    fontSize: 18,
    fontWeight: "800",
  },
  stub: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  stubCode: {
    color: INK,
    fontSize: 9,
    letterSpacing: 3,
    opacity: 0.7,
  },
});
