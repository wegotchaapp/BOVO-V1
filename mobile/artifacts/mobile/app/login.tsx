import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function Login() {
  const colors = useColors();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      router.replace(loggedInUser.onboarded ? "/(tabs)" : "/onboarding");
    } catch (e: any) {
      const msg =
        e?.message && typeof e.message === "string"
          ? e.message
          : "Login failed. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : 20 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>

          <View style={styles.headerBlock}>
            <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Sign in to continue your journey
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Email or Phone</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                placeholder="you@email.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
              <View style={styles.passWrap}>
                <TextInput
                  style={[styles.input, styles.passInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                  <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.forgotWrap}>
                <Text style={[styles.forgot, { color: colors.primary }]}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.88}
            >
              <Text style={styles.primaryBtnText}>{loading ? "Signing in..." : "Sign In"}</Text>
            </TouchableOpacity>

            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.mutedForeground }]}>or</Text>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity style={[styles.socialBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={styles.socialIcon}>🇬</Text>
                <Text style={[styles.socialText, { color: colors.foreground }]}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.socialBtn, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Text style={styles.socialIcon}>🍎</Text>
                <Text style={[styles.socialText, { color: colors.foreground }]}>Apple</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.signupRow}>
              <Text style={[styles.signupText, { color: colors.mutedForeground }]}>
                {"Don't have an account? "}
              </Text>
              <TouchableOpacity onPress={() => router.push("/register")}>
                <Text style={[styles.signupLink, { color: colors.primary }]}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 24, paddingBottom: 48 },
  back: { marginBottom: 32, width: 40 },
  headerBlock: { gap: 8, marginBottom: 36 },
  title: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -0.8 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular" },
  form: { gap: 20 },
  fieldGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  passWrap: { position: "relative" },
  passInput: { paddingRight: 50 },
  eyeBtn: { position: "absolute", right: 14, top: 16 },
  forgotWrap: { alignSelf: "flex-end", marginTop: 6 },
  forgot: { fontSize: 13, fontFamily: "Inter_500Medium" },
  primaryBtn: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  socialRow: { flexDirection: "row", gap: 12 },
  socialBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  socialIcon: { fontSize: 18 },
  socialText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  signupRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingTop: 8 },
  signupText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  signupLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
