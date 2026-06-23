import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

const SUN_R = 46;
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const RAY_LEN = 52;
const RAY_GAP = SUN_R + 12;

function makeParticles(h: number) {
  return Array.from({ length: 8 }, (_, i) => ({
    x: 20 + Math.random() * (width - 40),
    startY: h * 0.3 + Math.random() * h * 0.45,
    anim: new Animated.Value(0),
    delay: i * 450,
    duration: 3000 + Math.random() * 2000,
    size: 2.5 + Math.random() * 3,
  }));
}

export function SunnyScene({ height }: { height: number }) {
  const SUN_X = width * 0.7;
  const SUN_Y = height * 0.28;

  const pulseAnim  = useRef(new Animated.Value(0)).current;
  const rotAnim    = useRef(new Animated.Value(0)).current;
  const particles  = useRef(makeParticles(height)).current;

  useEffect(() => {
    // Sun pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    ).start();

    // Ray rotation
    Animated.loop(
      Animated.timing(rotAnim, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: false }),
    ).start();

    // Floating particles
    const anims = particles.map(({ anim, delay, duration }) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: false }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);

  const spin     = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const outerSc  = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const outerOp  = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] });
  const innerSc  = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const innerOp  = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0.62] });

  return (
    <View style={[styles.root, { height }]}>
      {/* Rich daytime sky */}
      <LinearGradient colors={["#0C6EAF", "#1A8ED4", "#41AEE8", "#82CFFA"]} style={StyleSheet.absoluteFill} />

      {/* Outer soft haze */}
      <Animated.View
        style={{
          position: "absolute",
          left: SUN_X - 110,
          top: SUN_Y - 110,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: "#FFE000",
          opacity: outerOp,
          transform: [{ scale: outerSc }],
        }}
      />

      {/* Inner glow ring */}
      <Animated.View
        style={{
          position: "absolute",
          left: SUN_X - 68,
          top: SUN_Y - 68,
          width: 136,
          height: 136,
          borderRadius: 68,
          backgroundColor: "#FFD700",
          opacity: innerOp,
          transform: [{ scale: innerSc }],
        }}
      />

      {/* Rotating rays */}
      <Animated.View style={{ position: "absolute", left: SUN_X, top: SUN_Y, transform: [{ rotate: spin }] }}>
        {ANGLES.map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const cx = Math.cos(rad);
          const cy = Math.sin(rad);
          return (
            <View
              key={angle}
              style={{
                position: "absolute",
                width: 4,
                height: RAY_LEN,
                borderRadius: 3,
                backgroundColor: "#FFE840",
                opacity: 0.88,
                left: cx * (RAY_GAP + RAY_LEN / 2) - 2,
                top:  cy * (RAY_GAP + RAY_LEN / 2) - RAY_LEN / 2,
                transform: [{ rotate: `${angle + 90}deg` }],
              }}
            />
          );
        })}
      </Animated.View>

      {/* Sun disc — bright yellow, clearly a sun */}
      <View
        style={{
          position: "absolute",
          left: SUN_X - SUN_R,
          top: SUN_Y - SUN_R,
          width: SUN_R * 2,
          height: SUN_R * 2,
          borderRadius: SUN_R,
          backgroundColor: "#FFF176",
        }}
      />

      {/* Floating dust particles */}
      {particles.map((p, i) => {
        const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [p.startY, p.startY - 85] });
        const opacity    = p.anim.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.8, 0.7, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: p.x,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: "rgba(255,255,220,0.95)",
              opacity,
              transform: [{ translateY }],
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", overflow: "hidden" },
});
