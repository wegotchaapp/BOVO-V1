import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

// Thick fog banks — tall, dense, overlapping
const BANKS = [
  { h: 110, yFrac: 0.02, opacity: 0.82, dur: 13000, fromRight: false, delay: 0     },
  { h: 130, yFrac: 0.18, opacity: 0.88, dur: 18000, fromRight: true,  delay: 1000  },
  { h: 100, yFrac: 0.35, opacity: 0.75, dur: 10500, fromRight: false, delay: 2500  },
  { h: 120, yFrac: 0.50, opacity: 0.85, dur: 21000, fromRight: true,  delay: 0     },
  { h: 90,  yFrac: 0.68, opacity: 0.70, dur: 14000, fromRight: false, delay: 3500  },
  { h: 110, yFrac: 0.82, opacity: 0.78, dur: 17000, fromRight: true,  delay: 1500  },
];

export function FogScene({ height }: { height: number }) {
  const anims = useRef(BANKS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const started = BANKS.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(b.delay),
          Animated.timing(anims[i], { toValue: 1, duration: b.dur, easing: Easing.linear, useNativeDriver: false }),
          Animated.timing(anims[i], { toValue: 0, duration: 0, useNativeDriver: false }),
        ]),
      ),
    );
    started.forEach((a) => a.start());
    return () => started.forEach((a) => a.stop());
  }, []);

  return (
    <View style={[styles.root, { height }]}>
      {/* Very light, washed-out sky — clearly different from night */}
      <LinearGradient
        colors={["#CBD8DF", "#DAE6ED", "#E8F2F7", "#F3F8FB"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Dense fog banks */}
      {BANKS.map((b, i) => {
        const tx = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: b.fromRight
            ? [width * 0.4, -width * 0.9]
            : [-width * 0.8, width * 0.6],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              top: height * b.yFrac,
              width: width * 2.2,
              height: b.h,
              borderRadius: b.h / 2,
              backgroundColor: `rgba(255,255,255,${b.opacity})`,
              transform: [{ translateX: tx }],
            }}
          />
        );
      })}

      {/* "FOG" text indicator — subtle, low in frame */}
      <View style={styles.fogLabel}>
        <Text style={styles.fogText}>FOG</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { width: "100%", overflow: "hidden" },
  fogLabel: { position: "absolute", bottom: 14, left: 0, right: 0, alignItems: "center" },
  fogText:  { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(100,120,130,0.55)", letterSpacing: 4 },
});
