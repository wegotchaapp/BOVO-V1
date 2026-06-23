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

export default function Register() {
  const colors = useColors();
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name || !email || !phone || !password) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      Alert.alert(
        "Password too short",
        "Password must be at least 8 characters.",
      );
      return;
    }
    setLoading(true);
    try {
      await register(name, email, phone, password);
      router.push("/verify");
    } catch (e: any) {
      const status = e?.status as number | undefined;
      if (status === 409) {
        Alert.alert(
          "Account already exists",
          "An account with this email is already registered. Would you like to sign in instead?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign In",
              onPress: () => router.replace("/login"),
            },
          ],
        );
      } else {
        const msg =
          e?.message && typeof e.message === "string"
            ? e.message
            : "Registration failed. Please try again.";
        Alert.alert("Error", msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const fields = [
    { label: "Full Name", value: name, setter: setName, placeholder: "Jane Smith", keyboardType: "default" as const, autoCapitalize: "words" as const, icon: "user", secureTextEntry: false },
    { label: "Email Address", value: email, setter: setEmail, placeholder: "you@email.com", keyboardType: "email-address" as const, autoCapitalize: "none" as const, icon: "mail", secureTextEntry: false },
    { label: "Phone Number", value: phone, setter: setPhone, placeholder: "+1 (512) 000-0000", keyboardType: "phone-pad" as const, autoCapitalize: "none" as const, icon: "smartphone", secureTextEntry: false },
    { label: "Password", value: password, setter: setPassword, placeholder: "At least 8 characters", keyboardType: "default" as const, autoCapitalize: "none" as const, icon: "lock", secureTextEntry: true },
  ];

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
            <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Join thousands of Texans carpooling safely
            </Text>
          </View>

          <View style={styles.form}>
            {fields.map((field) => (
              <View key={field.label} style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>{field.label}</Text>
                <View style={styles.inputWrap}>
                  <Feather name={field.icon as any} size={16} color={colors.mutedForeground} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    value={field.value}
                    onChangeText={field.setter}
                    keyboardType={field.keyboardType}
                    autoCapitalize={field.autoCapitalize}
                    secureTextEntry={field.secureTextEntry}
                  />
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.88}
            >
              <Text style={styles.primaryBtnText}>{loading ? "Creating account..." : "Continue"}</Text>
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

            <View style={styles.termsRow}>
              <Text style={[styles.terms, { color: colors.mutedForeground }]}>
                By continuing you agree to our{" "}
                <Text style={{ color: colors.primary }}>Terms</Text> and{" "}
                <Text style={{ color: colors.primary }}>Privacy Policy</Text>
              </Text>
            </View>

            <View style={styles.loginRow}>
              <Text style={[styles.loginText, { color: colors.mutedForeground }]}>
                Already have an account?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.push("/login")}>
                <Text style={[styles.loginLink, { color: colors.primary }]}>Sign in</Text>
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
  inputWrap: { position: "relative" },
  inputIcon: { position: "absolute", left: 16, top: 18, zIndex: 1 },
  input: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingLeft: 44,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
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
  termsRow: { paddingHorizontal: 8 },
  terms: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  loginRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  loginText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  loginLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
