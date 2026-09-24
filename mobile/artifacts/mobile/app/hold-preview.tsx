import { Redirect } from "expo-router";
import React, { useState } from "react";
import { Platform, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { HoldToConfirm } from "@/components/HoldToConfirm";
import { UndoBar } from "@/components/UndoBar";

/** Sandbox for the hold-to-confirm control and its undo window. */
export default function HoldPreview() {
  const colors = useColors();
  const [log, setLog] = useState<string[]>([]);
  const [undoVisible, setUndoVisible] = useState(false);

  const note = (s: string) => setLog((l) => [s, ...l].slice(0, 5));

  if (!__DEV__) return <Redirect href="/" />;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.h, { color: colors.foreground }]}>Hold to confirm</Text>

        <HoldToConfirm
          label="Hold to post"
          confirmedLabel="Posted"
          icon="send"
          onConfirm={() => {
            note("posted");
            setUndoVisible(true);
          }}
        />

        <HoldToConfirm
          label="Hold to pay $51.18"
          confirmedLabel="Paying…"
          icon="lock"
          duration={1800}
          onConfirm={() => note("paid")}
        />

        <HoldToConfirm
          label="Hold to remove"
          confirmedLabel="Removed"
          icon="trash-2"
          tone="destructive"
          onConfirm={() => note("removed")}
        />

        <HoldToConfirm label="Disabled" icon="send" disabled onConfirm={() => {}} />

        <Text style={[styles.log, { color: colors.mutedForeground }]}>
          {log.length ? log.join("  ·  ") : "no events yet"}
        </Text>
      </View>

      <UndoBar
        visible={undoVisible}
        message="Adventure posted"
        onUndo={() => {
          note("undone");
          setUndoVisible(false);
        }}
        onExpire={() => setUndoVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flex: 1,
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "web" ? 80 : 24,
  },
  h: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 4 },
  log: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
});
