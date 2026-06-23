import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const N_DROPS = 35;

function makeDrops(h: number) {
  return Array.from({ length: N_DROPS }, (_, i) => ({
    x: Math.random() * (width + 60) - 30,
    anim: new Animated.Value(0),
    delay: (i / N_DROPS) * 700,
    duration: 380 + Math.random() * 260,
    len: 28 + Math.random() * 20,
    opacity: 0.45 + Math.random() * 0.45,
    height: h,
  }));
}

// A jagged lightning bolt rendered as a series of line segments
function LightningBolt({ x, opacity }: { x: number; opacity: Animated.AnimatedInterpolation<string | number> }) {
  const segments = [
    { dx: 12,  dy: 28, rotate: "35deg"  },
    { dx: -8,  dy: 22, rotate: "-25deg" },
    { dx: 14,  dy: 30, rotate: "42deg"  },
    { dx: -6,  dy: 20, rotate: "-18deg" },
  ];
  return (
    <Animated.View style={{ position: "absolute", left: x, top: 12, opacity }}>
      {segments.map((s, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            top: i * 24,
            left: segments.slice(0, i).reduce((acc, sg) => acc + sg.dx, 0),
            width: 4,
            height: 30,
            borderRadius: 2,
            backgroundColor: "#FFE87A",
            transform: [{ rotate: s.rotate }],
          }}
        />
      ))}
    </Animated.View>
  );
}

export function ThunderstormScene({ height }: { height: number }) {
  const drops      = useRef(makeDrops(height)).current;
  const flashAnim  = useRef(new Animated.Value(0)).current;
  const boltOp     = useRef(new Animated.Value(0)).current;
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const rainAnims = drops.map(({ anim, delay, duration }) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: false }),
        ]),
      ),
    );
    rainAnims.forEach((a) => a.start());

    function flash() {
      // Bolt appears briefly
      boltOp.setValue(1);
      Animated.sequence([
        // Double flash pattern
        Animated.timing(flashAnim, { toValue: 0.95, duration: 55,  useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 0,    duration: 70,  useNativeDriver: false }),
        Animated.delay(100),
        Animated.timing(flashAnim, { toValue: 0.7,  duration: 55,  useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 0,    duration: 100, useNativeDriver: false }),
      ]).start(() => boltOp.setValue(0));

      flashTimer.current = setTimeout(flash, 2800 + Math.random() * 3500);
    }
    flashTimer.current = setTimeout(flash, 1000);

    return () => {
      rainAnims.forEach((a) => a.stop());
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  return (
    <View style={[styles.root, { height }]}>
      {/* Dark storm sky — deeper than night but with blue-purple tones so it reads as "storm" not "night" */}
      <LinearGradient colors={["#0D1420", "#141D2C", "#1B2638", "#223040"]} style={StyleSheet.absoluteFill} />

      {/* Purple-tinted storm tinge at top */}
      <LinearGradient
        colors={["rgba(60,20,80,0.55)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: height * 0.5 }}
      />

      {/* Lightning bolt (visible bolt shape) */}
      <LightningBolt x={width * 0.55} opacity={boltOp} />

      {/* Heavy cloud layer */}
      <View style={[styles.cloudLayer, { width: width + 60, top: -10, left: -30, backgroundColor: "rgba(8,12,22,0.85)" }]} />

      {/* Dense angled rain */}
      <View style={[StyleSheet.absoluteFill, styles.rainAngle]}>
        {drops.map((d, i) => {
          const translateY = d.anim.interpolate({ inputRange: [0, 1], outputRange: [-d.len, height + d.len] });
          return (
            <Animated.View
              key={i}
              style={{
                position: "absolute",
                left: d.x,
                top: 0,
                width: 1.5,
                height: d.len,
                borderRadius: 1,
                backgroundColor: `rgba(140,185,220,${d.opacity})`,
                transform: [{ translateY }],
              }}
            />
          );
        })}
      </View>

      {/* Lightning flash overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#D4E8FF", opacity: flashAnim }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { width: "100%", overflow: "hidden" },
  cloudLayer: { position: "absolute", height: 85, borderBottomLeftRadius: 50, borderBottomRightRadius: 50 },
  rainAngle:  { transform: [{ rotate: "-12deg" }], overflow: "hidden" },
});
