import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

function makeStars(h: number) {
  return Array.from({ length: 22 }, (_, i) => ({
    x: 10 + Math.random() * (width - 20),
    y: 10 + Math.random() * (h * 0.85),
    size: 1.5 + Math.random() * 3,
    anim: new Animated.Value(Math.random()),
    duration: 1200 + Math.random() * 1800,
    delay: i * 150,
  }));
}

export function NightScene({ height }: { height: number }) {
  const MOON_X = width * 0.25;
  const MOON_Y = height * 0.22;
  const MOON_R = 34;

  const moonGlow   = useRef(new Animated.Value(0)).current;
  const shootAnim  = useRef(new Animated.Value(0)).current;
  const stars      = useRef(makeStars(height)).current;
  const shootTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Moon glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(moonGlow, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(moonGlow, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    ).start();

    // Star twinkle
    const starAnims = stars.map(({ anim, duration, delay }) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1,    duration, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0.12, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]),
      ),
    );
    starAnims.forEach((a) => a.start());

    // Shooting star
    function fireShoot() {
      shootAnim.setValue(0);
      Animated.timing(shootAnim, { toValue: 1, duration: 850, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
      shootTimer.current = setTimeout(fireShoot, 8000 + Math.random() * 7000);
    }
    shootTimer.current = setTimeout(fireShoot, 3000);

    return () => {
      starAnims.forEach((a) => a.stop());
      if (shootTimer.current) clearTimeout(shootTimer.current);
    };
  }, []);

  const glowOp  = moonGlow.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.55] });
  const glowSc  = moonGlow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });

  const shootX  = shootAnim.interpolate({ inputRange: [0, 1], outputRange: [width + 40, -80] });
  const shootY  = shootAnim.interpolate({ inputRange: [0, 1], outputRange: [height * 0.1, height * 0.26] });
  const shootOp = shootAnim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 0.95, 0.8, 0] });

  return (
    <View style={[styles.root, { height }]}>
      <LinearGradient colors={["#020610", "#070E22", "#0C1535", "#11203E"]} style={StyleSheet.absoluteFill} />

      {/* Moon soft outer glow (large, very translucent) */}
      <Animated.View
        style={{
          position: "absolute",
          left: MOON_X - 70,
          top: MOON_Y - 70,
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: "#C8D8F8",
          opacity: glowOp,
          transform: [{ scale: glowSc }],
        }}
      />

      {/* Moon inner glow (medium) */}
      <View
        style={{
          position: "absolute",
          left: MOON_X - 46,
          top: MOON_Y - 46,
          width: 92,
          height: 92,
          borderRadius: 46,
          backgroundColor: "rgba(210,225,255,0.35)",
        }}
      />

      {/* Full moon disc — clean, no donut effect */}
      <View
        style={{
          position: "absolute",
          left: MOON_X - MOON_R,
          top: MOON_Y - MOON_R,
          width: MOON_R * 2,
          height: MOON_R * 2,
          borderRadius: MOON_R,
          backgroundColor: "#EEF2FF",
        }}
      />

      {/* Moon surface detail (subtle crater-like slightly darker circle) */}
      <View
        style={{
          position: "absolute",
          left: MOON_X + 6,
          top: MOON_Y - 8,
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: "rgba(180,195,230,0.4)",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: MOON_X - 14,
          top: MOON_Y + 6,
          width: 9,
          height: 9,
          borderRadius: 5,
          backgroundColor: "rgba(175,190,220,0.35)",
        }}
      />

      {/* Stars */}
      {stars.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: "#F8F8F0",
            opacity: s.anim,
          }}
        />
      ))}

      {/* Shooting star */}
      <Animated.View
        style={{
          position: "absolute",
          width: 65,
          height: 2,
          borderRadius: 1,
          backgroundColor: "rgba(255,255,240,0.92)",
          opacity: shootOp,
          transform: [{ translateX: shootX }, { translateY: shootY }, { rotate: "165deg" }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", overflow: "hidden" },
});
