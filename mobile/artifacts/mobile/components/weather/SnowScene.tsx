import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const N = 32; // increased from 16

function makeFlakes(h: number) {
  return Array.from({ length: N }, (_, i) => ({
    x: Math.random() * width,
    size: 4 + Math.random() * 9,           // slightly larger range
    fallAnim: new Animated.Value(0),
    swayAnim: new Animated.Value(0),
    delay: i * 200,
    fallDur: 2800 + Math.random() * 2200,   // slightly faster
    swayDur: 1600 + Math.random() * 1200,
    swayDist: 12 + Math.random() * 22,
    opacity: 0.65 + Math.random() * 0.35,  // more opaque
    height: h,
  }));
}

export function SnowScene({ height }: { height: number }) {
  const flakes = useRef(makeFlakes(height)).current;

  useEffect(() => {
    const anims: Animated.CompositeAnimation[] = [];

    flakes.forEach(({ fallAnim, swayAnim, delay, fallDur, swayDur }) => {
      anims.push(
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(fallAnim, { toValue: 1, duration: fallDur, easing: Easing.linear, useNativeDriver: false }),
            Animated.timing(fallAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
          ]),
        ),
      );
      anims.push(
        Animated.loop(
          Animated.sequence([
            Animated.timing(swayAnim, { toValue: 1,  duration: swayDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
            Animated.timing(swayAnim, { toValue: -1, duration: swayDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          ]),
        ),
      );
    });

    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={[styles.root, { height }]}>
      <LinearGradient colors={["#6894B2", "#88AEC8", "#AACAE0", "#CCE4F4"]} style={StyleSheet.absoluteFill} />

      {flakes.map((f, i) => {
        const translateY = f.fallAnim.interpolate({ inputRange: [0, 1], outputRange: [-f.size * 2, height + f.size * 2] });
        const translateX = f.swayAnim.interpolate({ inputRange: [-1, 1], outputRange: [-f.swayDist, f.swayDist] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: f.x,
              top: 0,
              width: f.size,
              height: f.size,
              borderRadius: f.size / 2,
              backgroundColor: "rgba(255,255,255,0.97)",
              opacity: f.opacity,
              transform: [{ translateY }, { translateX }],
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
