import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const SUN_R = 34;

export function PartlyCloudyScene({ height }: { height: number }) {
  const SUN_X = width * 0.74;
  const SUN_Y = height * 0.22;

  const glowAnim  = useRef(new Animated.Value(0)).current;
  const cloud1Anim = useRef(new Animated.Value(0)).current;
  const cloud2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    ).start();

    const c1 = Animated.loop(
      Animated.sequence([
        Animated.timing(cloud1Anim, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(cloud1Anim, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    const c2 = Animated.loop(
      Animated.sequence([
        Animated.delay(7000),
        Animated.timing(cloud2Anim, { toValue: 1, duration: 26000, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(cloud2Anim, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    );
    c1.start(); c2.start();
    return () => { c1.stop(); c2.stop(); };
  }, []);

  const glowOp  = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] });
  const glowSc  = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });
  const tx1 = cloud1Anim.interpolate({ inputRange: [0, 1], outputRange: [width + 20, -220] });
  const tx2 = cloud2Anim.interpolate({ inputRange: [0, 1], outputRange: [-220, width + 20] });

  return (
    <View style={[styles.root, { height }]}>
      <LinearGradient colors={["#1990D8", "#3AABEC", "#62C2F5", "#93D9FF"]} style={StyleSheet.absoluteFill} />

      {/* Sun glow */}
      <Animated.View style={[styles.glow, { left: SUN_X - 65, top: SUN_Y - 65, opacity: glowOp, transform: [{ scale: glowSc }] }]} />

      {/* Sun disc */}
      <View style={[styles.sun, { left: SUN_X - SUN_R, top: SUN_Y - SUN_R, width: SUN_R * 2, height: SUN_R * 2, borderRadius: SUN_R }]} />

      {/* Cloud 1 */}
      <Animated.View style={{ position: "absolute", top: height * 0.3, transform: [{ translateX: tx1 }], opacity: 0.92 }}>
        <View style={styles.cloudGroup}>
          <View style={[styles.blob, { width: 80, height: 80, borderRadius: 40, left: 0, top: 18 }]} />
          <View style={[styles.blob, { width: 110, height: 110, borderRadius: 55, left: 48, top: 0 }]} />
          <View style={[styles.blob, { width: 80, height: 80, borderRadius: 40, left: 126, top: 18 }]} />
        </View>
      </Animated.View>

      {/* Cloud 2 (smaller) */}
      <Animated.View style={{ position: "absolute", top: height * 0.55, transform: [{ translateX: tx2 }], opacity: 0.78 }}>
        <View style={styles.cloudGroup}>
          <View style={[styles.blob, { width: 55, height: 55, borderRadius: 28, left: 0, top: 12 }]} />
          <View style={[styles.blob, { width: 75, height: 75, borderRadius: 38, left: 34, top: 0 }]} />
          <View style={[styles.blob, { width: 55, height: 55, borderRadius: 28, left: 88, top: 12 }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { width: "100%", overflow: "hidden" },
  glow:       { position: "absolute", width: 130, height: 130, borderRadius: 65, backgroundColor: "#FFD200" },
  sun:        { position: "absolute", backgroundColor: "#FFFDE0" },
  cloudGroup: { position: "relative", width: 210, height: 110 },
  blob:       { position: "absolute", backgroundColor: "rgba(255,255,255,0.94)" },
});
