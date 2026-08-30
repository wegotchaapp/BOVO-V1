/**
 * Design preview for the ticket printer, on a loop.
 *
 * Not linked from anywhere in the app — reach it at /printer-preview. It exists
 * so the print sequence can be judged without standing up a backend and paying
 * for a real trip. Safe to delete once the animation is signed off.
 */
import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { ReceiptPrinterStage } from "@/components/ReceiptPrinter";
import { TicketPrintOverlay } from "@/components/TicketPrintOverlay";
import { useColors } from "@/hooks/useColors";

export default function PrinterPreview() {
  const colors = useColors();
  const [stage, setStage] = useState<ReceiptPrinterStage>("processing");
  const [run, setRun] = useState(0);

  useEffect(() => {
    setStage("processing");
    const a = setTimeout(() => setStage("printing"), 1200);
    const b = setTimeout(() => setStage("complete"), 3100);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [run]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <TicketPrintOverlay
        onDone={() => setRun((n) => n + 1)}
        onHome={() => setRun((n) => n + 1)}
        stage={stage}
      />
      <TouchableOpacity
        onPress={() => setRun((n) => n + 1)}
        style={styles.replay}
        testID="replay"
      >
        <Text style={styles.replayText}>Replay</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  replay: {
    backgroundColor: "#1B3D2F",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: "absolute",
    right: 16,
    top: 16,
    zIndex: 200,
  },
  replayText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
