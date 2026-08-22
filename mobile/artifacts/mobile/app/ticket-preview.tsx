import React, { useEffect, useState } from "react";
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

import { useColors } from "@/hooks/useColors";
import { Ticket, ticketBox } from "@/components/Ticket";
import {
  PRINT_DURATION_MS,
  TicketPrinter,
  type PrinterStage,
} from "@/components/TicketPrinter";

/**
 * Standalone preview of the booking-confirmed printer, with mock data so it renders
 * without a backend, a session or a real booking. Sibling of `weather-demo.tsx`.
 */
export default function TicketPreview() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [stage, setStage] = useState<PrinterStage>("processing");
  const [run, setRun] = useState(0);

  const ticketWidth = Math.round(Math.min(width * 0.50, 184));
  const { boxHeight: ticketHeight } = ticketBox(ticketWidth);

  useEffect(() => {
    setStage("processing");
    const toPrint = setTimeout(() => setStage("printing"), 900);
    const toDone = setTimeout(
      () => setStage("complete"),
      900 + PRINT_DURATION_MS,
    );
    return () => {
      clearTimeout(toPrint);
      clearTimeout(toDone);
    };
  }, [run]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <TicketPrinter
          stage={stage}
          title="Dallas → Austin"
          subtitle="1 seat · Fri, Sep 5 · 8:30 AM"
          total="$51.18"
          ticketHeight={ticketHeight}
        >
          <Ticket
            fromCity="Dallas"
            toCity="Austin"
            date="05.09"
            departs="08:30"
            voyager="Marcus Ellery"
            seats={1}
            reference="BV-260905-031"
            width={ticketWidth}
          />
        </TicketPrinter>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={() => setRun((n) => n + 1)}
          activeOpacity={0.88}
        >
          <Text style={styles.btnText}>Print again</Text>
        </TouchableOpacity>
        <Text style={[styles.stage, { color: colors.mutedForeground }]}>
          stage: {stage}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "web" ? 67 : 20,
    paddingBottom: 28,
  },
  btn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999 },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  stage: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
