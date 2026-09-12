import { HoldToConfirm } from "./HoldToConfirm";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CARD_SHADOW, STRONG_SHADOW } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";

/**
 * Bovogo's dialog layer.
 *
 * React Native's own `Alert` is a no-op under react-native-web, so every
 * confirmation and validation message silently did nothing in the browser.
 * This host renders one branded modal that behaves identically on web and
 * native, driven by the imperative API in `lib/alert.ts`.
 */

export type AlertButtonStyle = "default" | "cancel" | "destructive";

export interface AlertButton {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: AlertButtonStyle;
  hold?: boolean;
}

export interface AlertRequest {
  title: string;
  message?: string;
  buttons: AlertButton[];
  /** Called once a button has been chosen (or the dialog dismissed). */
  resolve: (index: number) => void;
  /** Index invoked when the user taps the scrim / presses back. */
  dismissIndex: number;
}

type Subscriber = (queue: AlertRequest[]) => void;

const queue: AlertRequest[] = [];
let subscriber: Subscriber | null = null;

function emit() {
  subscriber?.([...queue]);
}

/**
 * Enqueue a dialog. Falls back to the browser's blocking dialogs only if the
 * host has not mounted yet (e.g. an error thrown during the very first render).
 */
export function enqueueAlert(
  request: Omit<AlertRequest, "resolve" | "dismissIndex"> & {
    resolve: (index: number) => void;
    dismissIndex?: number;
  },
) {
  const buttons =
    request.buttons.length > 0 ? request.buttons : [{ text: "OK" }];
  const cancelIndex = buttons.findIndex((b) => b.style === "cancel");

  const entry: AlertRequest = {
    title: request.title,
    message: request.message,
    buttons,
    resolve: request.resolve,
    dismissIndex: request.dismissIndex ?? (cancelIndex >= 0 ? cancelIndex : -1),
  };

  if (!subscriber) {
    // No host mounted — degrade rather than swallow the message entirely.
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const full = entry.message
        ? `${entry.title}\n\n${entry.message}`
        : entry.title;
      if (entry.buttons.length > 1 && cancelIndex >= 0) {
        const confirmed = window.confirm(full);
        const primary = entry.buttons.findIndex((b) => b.style !== "cancel");
        entry.resolve(confirmed ? (primary >= 0 ? primary : 0) : cancelIndex);
      } else {
        window.alert(full);
        entry.resolve(0);
      }
    } else {
      entry.resolve(entry.dismissIndex);
    }
    return;
  }

  queue.push(entry);
  emit();
}

export function AlertHost() {
  const colors = useColors();
  const [pending, setPending] = useState<AlertRequest[]>([]);
  const busy = useRef(false);

  useEffect(() => {
    subscriber = setPending;
    return () => {
      subscriber = null;
    };
  }, []);

  const current = pending[0] ?? null;

  // A fresh dialog is interactive again.
  useEffect(() => {
    busy.current = false;
  }, [current]);

  const choose = useCallback((index: number) => {
    if (busy.current) return;
    busy.current = true;

    const entry = queue.shift();
    emit();
    if (!entry) return;

    const button = index >= 0 ? entry.buttons[index] : undefined;
    entry.resolve(index);
    void button?.onPress?.();
  }, []);

  if (!current) return null;

  const { title, message, buttons, dismissIndex } = current;
  // Two buttons sit side by side; three or more stack for legibility.
  const stacked =
    buttons.length > 2 ||
    buttons.some((button) => button.style === "destructive" || button.hold);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => choose(dismissIndex)}
    >
      <Pressable
        style={styles.scrim}
        onPress={() => {
          if (dismissIndex >= 0) choose(dismissIndex);
        }}
      >
        {/* Stop taps inside the card from reaching the scrim. */}
        <Pressable
          style={[styles.card, STRONG_SHADOW, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          <Text style={[styles.title, { color: colors.foreground }]}>
            {title}
          </Text>
          {message ? (
            <Text style={[styles.message, { color: colors.mutedForeground }]}>
              {message}
            </Text>
          ) : null}

          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {buttons.map((button, index) => {
              const destructive = button.style === "destructive";
              const cancel = button.style === "cancel";
              const background = destructive
                ? colors.destructive
                : cancel
                  ? colors.muted
                  : colors.primary;
              const foreground = cancel ? colors.foreground : "#FFFFFF";

              if (destructive || button.hold)
                return (
                  <HoldToConfirm
                    key={`${button.text}-${index}`}
                    label={`Hold to ${button.text.toLowerCase()}`}
                    tone={destructive ? "destructive" : "primary"}
                    onConfirm={() => choose(index)}
                    style={{
                      height: 48,
                      borderRadius: 24,
                      ...(!stacked ? { flex: 1 } : {}),
                    }}
                  />
                );
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  style={({ pressed }) => [
                    styles.button,
                    !stacked && styles.buttonInline,
                    CARD_SHADOW,
                    {
                      backgroundColor: background,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  onPress={() => choose(index)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.buttonText, { color: foreground }]}>
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: "rgba(17,18,16,0.55)",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    gap: 10,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  message: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionsStacked: { flexDirection: "column-reverse" },
  button: {
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  buttonInline: { flex: 1 },
  buttonText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
