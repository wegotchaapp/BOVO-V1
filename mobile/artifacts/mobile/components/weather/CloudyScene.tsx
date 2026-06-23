import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

function Cloud({
  x, y, scale, opacity,
}: {
  x: Animated.AnimatedInterpolation<string | number>;
  y: number; scale: number; opacity: number;
}) {
  return (
    <Animated.View style={{ position: "absolute", top: y, transform: [{ translateX: x }], opacity }}>
      <View style={{ position: "relative", width: 200 * scale, height: 90 * scale }}>
        <View style={[styles.blob, { width: 80 * scale,  height: 80 * scale,  borderRadius: 40 * scale, left: 0,           top: 20 * scale }]} />
        <View style={[styles.blob, { width: 110 * scale, height: 110 * scale, borderRadius: 55 * scale, left: 55 * scale,  top: 0          }]} />
        <View style={[styles.blob, { width: 80 * scale,  height: 80 * scale,  borderRadius: 40 * scale, left: 130 * scale, top: 20 * scale }]} />
      </View>
    </Animated.View>
  );
}

export function CloudyScene({ height }: { height: number }) {
  const c1 = useRef(new Animated.Value(0)).current;
  const c2 = useRef(new Animated.Value(0)).current;
  const c3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (anim: Animated.Value, dur: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: false }),
        ]),
      );
    const a1 = loop(c1, 20000, 0);
    const a2 = loop(c2, 25000, 5000);
    const a3 = loop(c3, 17000, 11000);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const tx1 = c1.interpolate({ inputRange: [0, 1], outputRange: [width + 30, -260] });
  const tx2 = c2.interpolate({ inputRange: [0, 1], outputRange: [width + 60, -290] });
  const tx3 = c3.interpolate({ inputRange: [0, 1], outputRange: [-290, width + 30] });

  return (
    <View style={[styles.root, { height }]}>
      {/* Light overcast sky — clearly daytime, not night */}
      <LinearGradient colors={["#8FA8BC", "#A2BBCE", "#B5CDD8", "#CCDDE6"]} style={StyleSheet.absoluteFill} />
      <Cloud x={tx1} y={height * 0.05} scale={1.1}  opacity={0.95} />
      <Cloud x={tx2} y={height * 0.36} scale={0.9}  opacity={0.85} />
      <Cloud x={tx3} y={height * 0.60} scale={1.3}  opacity={0.75} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", overflow: "hidden" },
  blob: { position: "absolute", backgroundColor: "rgba(235,240,245,0.96)" },
});
