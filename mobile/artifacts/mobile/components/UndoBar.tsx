import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
export type UndoBarProps = {
  visible: boolean;
  message: string;
  onExpire: () => void;
  onUndo: () => void;
  duration?: number;
};
export function UndoBar({
  visible,
  message,
  onExpire,
  onUndo,
  duration = 5000,
}: UndoBarProps) {
  const remaining = useSharedValue(1);
  const callbacks = useRef({ onExpire, onUndo });
  callbacks.current = { onExpire, onUndo };
  const active = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    active.current = visible;
    if (visible) {
      remaining.value = 1;
      remaining.value = withTiming(0, { duration, easing: Easing.linear });
      timer.current = setTimeout(() => {
        if (active.current) {
          active.current = false;
          callbacks.current.onExpire();
        }
      }, duration);
    }
    return () => {
      active.current = false;
      if (timer.current) clearTimeout(timer.current);
      cancelAnimation(remaining);
    };
  }, [visible, duration, remaining]);
  const fill = useAnimatedStyle(() => ({ width: remaining.value * 76 }));
  if (!visible) return null;
  return (
    <View
      style={{
        position: "absolute",
        bottom: Platform.OS === "web" ? 24 : 34,
        left: 16,
        right: 16,
        backgroundColor: "#FFF",
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 8px 30px rgba(0,0,0,.15)",
        zIndex: 50,
      }}
    >
      <Feather name="check-circle" size={18} color="#1B3D2F" />
      <Text
        accessibilityLiveRegion="polite"
        style={{ flex: 1, color: "#1B3D2F" }}
      >
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Undo"
        onPress={() => {
          if (!active.current) return;
          active.current = false;
          if (timer.current) clearTimeout(timer.current);
          callbacks.current.onUndo();
        }}
        style={{
          width: 76,
          height: 40,
          borderRadius: 10,
          overflow: "hidden",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#E8EBE6",
        }}
      >
        <Text style={{ color: "#1B3D2F", fontWeight: "600" }}>Undo</Text>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              backgroundColor: "#1A1D19",
              overflow: "hidden",
            },
            fill,
          ]}
        >
          <View
            style={{
              width: 76,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFF", fontWeight: "600" }}>Undo</Text>
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}
