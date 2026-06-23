import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function Landing() {
  const { user, isLoading } = useAuth();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.primary }]}>
        <ActivityIndicator color="rgba(255,255,255,0.9)" size="large" />
      </View>
    );
  }

  if (user?.onboarded) return <Redirect href="/(tabs)" />;
  if (user && !user.onboarded) return <Redirect href="/onboarding" />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={require("@/assets/images/hero-bg.png")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      <LinearGradient
        colors={["rgba(10,26,18,0.15)", "rgba(10,26,18,0.55)", "rgba(10,26,18,0.92)"]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.45, 1]}
      />

      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 12 },
        ]}
      >
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Feather name="shield" size={18} color="#fff" />
          </View>
          <Text style={styles.logoText}>Bovogo</Text>
        </View>
      </View>

      <View
        style={[
          styles.bottom,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 28 },
        ]}
      >
        <View style={styles.headline}>
          <Text style={styles.title}>Travel Texas,{"\n"}Safely Together.</Text>
          <Text style={styles.tagline}>
            Verified drivers. Real-time safety.{"\n"}Community you can trust.
          </Text>
        </View>

        <View style={styles.pills}>
          {["Insured Rides", "Verified People", "Live Tracking"].map((label) => (
            <View key={label} style={styles.pill}>
              <Text style={styles.pillText}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/register")}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryBtnText}>Get Started</Text>
            <Feather name="arrow-right" size={16} color="#1B3D2F" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/login")}
            activeOpacity={0.88}
          >
            <Text style={styles.secondaryBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    paddingHorizontal: 24,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  logoText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.3,
  },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    gap: 24,
  },
  headline: { gap: 12 },
  title: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -1.2,
    lineHeight: 46,
  },
  tagline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 22,
  },
  pills: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  pillText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.9)",
  },
  actions: { gap: 12 },
  primaryBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F8F7F3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#1B3D2F",
  },
  secondaryBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
