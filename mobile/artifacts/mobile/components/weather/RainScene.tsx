import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const N_DROPS = 22;

function makeDrops(h: number) {
  return Array.from({ length: N_DROPS }, (_, i) => ({
    x: Math.random() * (width + 40) - 20,
    anim: new Animated.Value(0),
    delay: (i / N_DROPS) * 900,
    duration: 550 + Math.random() * 380,
    len: 22 + Math.random() * 14,
    opacity: 0.35 + Math.random() * 0.45,
    height: h,
  }));
}

export function RainScene({ height }: { height: number }) {
  const drops = useRef(makeDrops(height)).current;

  useEffect(() => {
    const anims = drops.map(({ anim, delay, duration }) =>
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

  return (
    <View style={[styles.root, { height }]}>
      <LinearGradient colors={["#263240", "#344455", "#42556A", "#506070"]} style={StyleSheet.absoluteFill} />

      {/* Cloud mass at top */}
      <View style={[styles.cloudTop, { backgroundColor: "rgba(30,38,50,0.7)", top: -20, width: width + 60, left: -30 }]} />

      {/* Rain container, angled */}
      <View style={[StyleSheet.absoluteFill, styles.rainContainer]}>
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
                backgroundColor: `rgba(160,200,230,${d.opacity})`,
                transform: [{ translateY }],
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { width: "100%", overflow: "hidden" },
  rainContainer: { transform: [{ rotate: "-10deg" }], overflow: "hidden" },
  cloudTop:     { position: "absolute", height: 80, borderBottomLeftRadius: 40, borderBottomRightRadius: 40 },
});
