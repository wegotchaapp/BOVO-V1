import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width: SW, height: SH } = Dimensions.get("window");

const VAN_IMG = require("../assets/images/van.png");

const DASH_PITCH = 130;
const DASH_W = 42;
const DASH_H = 6;
const DASH_COUNT = Math.ceil(SW / DASH_PITCH) + 4;

const ROAD_TOP = SH * 0.54;
const ROAD_H = 72;

const STARS: { x: number; y: number; s: number }[] = [
  { x: 8, y: 6, s: 2 }, { x: 22, y: 13, s: 3 }, { x: 41, y: 4, s: 2 },
  { x: 57, y: 10, s: 2 }, { x: 74, y: 19, s: 3 }, { x: 86, y: 7, s: 2 },
  { x: 93, y: 22, s: 2 }, { x: 13, y: 28, s: 2 }, { x: 50, y: 23, s: 3 },
  { x: 35, y: 34, s: 2 }, { x: 68, y: 30, s: 2 }, { x: 3, y: 42, s: 2 },
  { x: 28, y: 39, s: 3 }, { x: 62, y: 37, s: 2 }, { x: 88, y: 35, s: 2 },
  { x: 79, y: 47, s: 2 }, { x: 47, y: 49, s: 3 }, { x: 17, y: 51, s: 2 },
];

// ─── Stars ────────────────────────────────────────────────────────────────────
function Stars() {
  return (
    <>
      {STARS.map((st, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: `${st.x}%` as any,
            top: `${st.y}%` as any,
            width: st.s,
            height: st.s,
            borderRadius: st.s / 2,
            backgroundColor: "rgba(255,255,255,0.75)",
          }}
        />
      ))}
    </>
  );
}

// ─── Hill shape ───────────────────────────────────────────────────────────────
function Hill({
  color,
  bottom,
  height,
  width,
  left,
}: {
  color: string;
  bottom: number;
  height: number;
  width: number;
  left: number;
}) {
  return (
    <View
      style={{
        position: "absolute",
        bottom,
        left,
        width,
        height,
        borderTopLeftRadius: width * 0.6,
        borderTopRightRadius: width * 0.5,
        backgroundColor: color,
      }}
    />
  );
}

// ─── Smoke particle ───────────────────────────────────────────────────────────
function SmokeParticle({ delay, size }: { delay: number; size: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.loop(
        Animated.timing(anim, { toValue: 1, duration: 1900, useNativeDriver: true })
      ).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  const opacity = anim.interpolate({
    inputRange: [0, 0.12, 0.55, 1],
    outputRange: [0, 0.6, 0.28, 0],
  });
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -85] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -52] });
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 2.1] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: -22,
        top: 12,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#6B7A70",
        opacity,
        transform: [{ translateX }, { translateY }, { scale }],
      }}
    />
  );
}

// ─── Pulsing dot ─────────────────────────────────────────────────────────────
function PulseDot({ delay }: { delay: number }) {
  const scale = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.4, duration: 420, useNativeDriver: true }),
        ])
      ).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View
      style={{
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: "#C4954A",
        transform: [{ scale }],
      }}
    />
  );
}

// ─── Main loading screen ──────────────────────────────────────────────────────
export function LoadingScreen() {
  const roadOffset = useRef(new Animated.Value(0)).current;
  const vanY = useRef(new Animated.Value(0)).current;
  const vanRotate = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const headlight = useRef(new Animated.Value(0.7)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in text
    Animated.timing(textOpacity, { toValue: 1, duration: 800, delay: 300, useNativeDriver: true }).start();

    // Road dashes scroll left (seamless DASH_PITCH loop)
    Animated.loop(
      Animated.timing(roadOffset, { toValue: -DASH_PITCH, duration: 650, useNativeDriver: true })
    ).start();

    // Van suspension bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(vanY, { toValue: -7, duration: 370, useNativeDriver: true }),
        Animated.timing(vanY, { toValue: 0, duration: 370, useNativeDriver: true }),
      ])
    ).start();

    // Subtle van tilt on bumps
    Animated.loop(
      Animated.sequence([
        Animated.timing(vanRotate, { toValue: 1, duration: 370, useNativeDriver: true }),
        Animated.timing(vanRotate, { toValue: -1, duration: 370, useNativeDriver: true }),
      ])
    ).start();

    // Progress bar fill → reset loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: SW - 80, duration: 2600, useNativeDriver: false }),
        Animated.delay(200),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    ).start();

    // Headlight gentle flicker
    Animated.loop(
      Animated.sequence([
        Animated.timing(headlight, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(headlight, { toValue: 0.55, duration: 140, useNativeDriver: true }),
        Animated.timing(headlight, { toValue: 0.95, duration: 280, useNativeDriver: true }),
        Animated.delay(2200),
      ])
    ).start();
  }, []);

  const rotateDeg = vanRotate.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-1.2deg", "1.2deg"],
  });

  return (
    <View style={s.container}>
      {/* Stars */}
      <Stars />

      {/* Moon */}
      <View style={s.moon} />

      {/* Background hills — far layer */}
      <Hill color="#1B2D22" bottom={SH * 0.41} height={SH * 0.22} width={SW * 0.65} left={-SW * 0.06} />
      <Hill color="#1B2D22" bottom={SH * 0.41} height={SH * 0.17} width={SW * 0.55} left={SW * 0.52} />

      {/* Foreground hills — nearer */}
      <Hill color="#172620" bottom={SH * 0.36} height={SH * 0.16} width={SW * 0.5} left={-SW * 0.02} />
      <Hill color="#172620" bottom={SH * 0.36} height={SH * 0.14} width={SW * 0.48} left={SW * 0.58} />

      {/* Road band */}
      <View style={s.road}>
        {/* Edge glow lines */}
        <View style={s.edgeTop} />
        <View style={s.edgeBottom} />

        {/* Scrolling center dashes */}
        <View style={s.dashClip}>
          <Animated.View
            style={[s.dashTrack, { transform: [{ translateX: roadOffset }] }]}
          >
            {Array.from({ length: DASH_COUNT + 2 }).map((_, i) => (
              <View key={i} style={[s.dash, { left: i * DASH_PITCH }]} />
            ))}
          </Animated.View>
        </View>
      </View>

      {/* Van + smoke */}
      <Animated.View
        style={[
          s.vanWrap,
          { transform: [{ translateY: vanY }, { rotate: rotateDeg }] },
        ]}
      >
        {/* Smoke particles */}
        <SmokeParticle delay={0} size={20} />
        <SmokeParticle delay={650} size={27} />
        <SmokeParticle delay={1200} size={19} />

        {/* Headlight cone */}
        <Animated.View style={[s.headlightCone, { opacity: headlight }]} />
        <Animated.View style={[s.headlightDot, { opacity: headlight }]} />

        {/* Van */}
        <Image source={VAN_IMG} style={s.van} resizeMode="contain" />
      </Animated.View>

      {/* Bottom: text + progress */}
      <Animated.View style={[s.bottom, { opacity: textOpacity }]}>
        <Text style={s.loadingText}>Loading your adventure...</Text>
        <View style={s.progressTrack}>
          <Animated.View style={[s.progressFill, { width: progress }]} />
          {/* Shimmer dot at progress tip */}
          <Animated.View style={[s.progressTip, { left: progress }]} />
        </View>
        <View style={s.dotsRow}>
          <PulseDot delay={0} />
          <PulseDot delay={220} />
          <PulseDot delay={440} />
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#131C17",
    overflow: "hidden",
  },
  moon: {
    position: "absolute",
    top: SH * 0.07,
    left: SW * 0.08,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#263328",
    shadowColor: "#fff",
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },

  // Road
  road: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ROAD_TOP,
    height: ROAD_H,
    backgroundColor: "#232E27",
  },
  edgeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#C4954A",
    opacity: 0.5,
  },
  edgeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#C4954A",
    opacity: 0.5,
  },
  dashClip: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ROAD_H / 2 - DASH_H / 2,
    height: DASH_H,
    overflow: "hidden",
  },
  dashTrack: {
    position: "absolute",
    top: 0,
    left: 0,
    flexDirection: "row",
  },
  dash: {
    position: "absolute",
    top: 0,
    width: DASH_W,
    height: DASH_H,
    borderRadius: 3,
    backgroundColor: "#C4954A",
    opacity: 0.75,
  },

  // Van
  vanWrap: {
    position: "absolute",
    left: SW * 0.33,
    top: ROAD_TOP - 64,
    width: 150,
    height: 80,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  van: {
    width: 150,
    height: 78,
  },
  headlightCone: {
    position: "absolute",
    right: -30,
    top: 22,
    width: 50,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,228,100,0.22)",
  },
  headlightDot: {
    position: "absolute",
    right: 16,
    top: 28,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,240,140,0.9)",
    shadowColor: "#FFE864",
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },

  // Bottom
  bottom: {
    position: "absolute",
    bottom: SH * 0.1,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(248,247,243,0.55)",
    letterSpacing: 0.3,
  },
  progressTrack: {
    width: SW - 80,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "visible",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#C4954A",
  },
  progressTip: {
    position: "absolute",
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E8B86D",
    marginLeft: -5,
    shadowColor: "#C4954A",
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
});
