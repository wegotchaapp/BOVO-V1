/**
 * The moment after paying: the printer works, then feeds the ticket out.
 *
 * Stage is owned by the caller so the machine tracks the real payment — it
 * sits on "processing" for exactly as long as the charge takes, rather than
 * running a canned timer.
 */
import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  ReceiptPrinter,
  type ReceiptPrinterStage,
} from "@/components/ReceiptPrinter";
import { TripTicket, type TripTicketProps } from "@/components/TripTicket";
import { useColors } from "@/hooks/useColors";

/** Rough vertical budget for the machine and the action button below it. */
const MACHINE_BLOCK = 250;
const ACTION_BLOCK = 130;
const MIN_TICKET_WIDTH = 170;
const MAX_TICKET_WIDTH = 248;

export interface TicketPrintOverlayProps {
  /** Summary line under the route, e.g. "1 seat · Sat Aug 11". */
  detail?: string;
  onDone: () => void;
  onHome?: () => void;
  route?: string;
  stage: ReceiptPrinterStage;
  ticket?: TripTicketProps;
  total?: string;
}

export function TicketPrintOverlay({
  detail = "1 seat · Sat, Aug 11",
  onDone,
  onHome,
  route = "Austin → Houston",
  stage,
  ticket,
  total = "$38.40",
}: TicketPrintOverlayProps) {
  const colors = useColors();
  const { height } = useWindowDimensions();
  const isComplete = stage === "complete";

  const roomForTicket = height - MACHINE_BLOCK - ACTION_BLOCK;
  const ticketWidth = Math.max(
    MIN_TICKET_WIDTH,
    Math.min(MAX_TICKET_WIDTH, (roomForTicket * 5) / 12),
  );

  return (
    <View style={[styles.scrim, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[
            styles.stage,
            { paddingTop: Platform.OS === "web" ? 67 : 0 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ReceiptPrinter.Root stage={stage}>
            <ReceiptPrinter.Machine>
              <ReceiptPrinter.Header>
                <View style={styles.mark}>
                  <Feather color="#8A9A8D" name="navigation" size={14} />
                </View>
                {onHome ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={onHome}
                    style={styles.homeBtn}
                  >
                    <Feather color="#F8F7F3" name="home" size={13} />
                    <Text style={styles.homeText}>Home</Text>
                  </TouchableOpacity>
                ) : null}
              </ReceiptPrinter.Header>

              <ReceiptPrinter.Screen>
                <View style={styles.screenRow}>
                  <View style={styles.screenMain}>
                    <Text numberOfLines={1} style={styles.screenTitle}>
                      {route}
                    </Text>
                    <Text numberOfLines={1} style={styles.screenSub}>
                      {detail}
                    </Text>
                  </View>
                  <View style={styles.screenTotals}>
                    <Text style={styles.screenTotalLabel}>Total</Text>
                    <Text style={styles.screenTotal}>{total}</Text>
                  </View>
                </View>

                <View style={styles.statusWrap}>
                  <ReceiptPrinter.Status />
                </View>
              </ReceiptPrinter.Screen>
            </ReceiptPrinter.Machine>

            <ReceiptPrinter.Output>
              <TripTicket width={ticketWidth} {...ticket} />
            </ReceiptPrinter.Output>
          </ReceiptPrinter.Root>

          {isComplete ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onDone}
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.doneText}>View my booking</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  safe: {
    flex: 1,
  },
  stage: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  mark: {
    alignItems: "center",
    backgroundColor: "#27342E",
    borderRadius: 8,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  homeBtn: {
    alignItems: "center",
    backgroundColor: "#27342E",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  homeText: {
    color: "#F8F7F3",
    fontSize: 12,
    fontWeight: "600",
  },
  screenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  screenMain: {
    flexShrink: 1,
    paddingRight: 12,
  },
  screenTitle: {
    color: "#F8F7F3",
    fontSize: 15,
    fontWeight: "700",
  },
  screenSub: {
    color: "#8A9A8D",
    fontSize: 12,
    marginTop: 3,
  },
  screenTotals: {
    alignItems: "flex-end",
  },
  screenTotalLabel: {
    color: "#8A9A8D",
    fontSize: 11,
  },
  screenTotal: {
    color: "#F8F7F3",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  statusWrap: {
    marginTop: 18,
  },
  doneBtn: {
    alignItems: "center",
    borderRadius: 14,
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 15,
  },
  doneText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
