import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { CARD_SHADOW } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";

const OPTIONS = [
  {
    id: "record",
    icon: "mic",
    title: "Record Silently",
    subtitle: "Start a silent audio recording in the background",
    color: "#2563EB",
    bg: "#EFF6FF",
  },
  {
    id: "share",
    icon: "map-pin",
    title: "Share Live Location",
    subtitle: "Send your real-time GPS to an emergency contact",
    color: "#7C3AED",
    bg: "#F5F3FF",
  },
  {
    id: "contact",
    icon: "phone",
    title: "Call Emergency Contact",
    subtitle: "Discreetly call your saved emergency contact",
    color: "#059669",
    bg: "#ECFDF5",
  },
  {
    id: "911",
    icon: "alert-octagon",
    title: "Call 911",
    subtitle: "Connect directly to emergency services",
    color: "#DC2626",
    bg: "#FEF2F2",
  },
];

export default function SafetyUnsafe() {
  const colors = useColors();
  const router = useRouter();
  const [safeWord, setSafeWord] = useState("");
  const [wordSaved, setWordSaved] = useState(false);

  function handleOption(id: string) {
    if (id === "911") {
      Alert.alert("Calling 911", "In a real emergency, this would dial 911 immediately.", [{ text: "OK" }]);
    } else if (id === "record") {
      Alert.alert("Recording Started", "Silent recording is running. It will stop when you end the trip.", [{ text: "OK" }]);
    } else if (id === "share") {
      Alert.alert("Location Shared", "Your live location has been sent to your emergency contact.", [{ text: "OK" }]);
    } else if (id === "contact") {
      Alert.alert("Calling Contact", "Connecting to your emergency contact now.", [{ text: "OK" }]);
    }
  }

  function saveSafeWord() {
    if (!safeWord.trim()) return;
    setWordSaved(true);
    Alert.alert("Safe Word Set", `"${safeWord.trim()}" is your safe word. If you text this to anyone, Bovogo will automatically alert your emergency contacts.`, [{ text: "Got it" }]);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>I Feel Unsafe</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.banner, { backgroundColor: "#FEF2F2" }]}>
        <Feather name="alert-triangle" size={18} color="#DC2626" />
        <Text style={[styles.bannerText, { color: "#991B1B" }]}>
          Your location and trip details are being monitored. Choose an action below.
        </Text>
      </View>

      <View style={styles.content}>
        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[styles.optCard, CARD_SHADOW]}
            onPress={() => handleOption(opt.id)}
            activeOpacity={0.85}
          >
            <View style={[styles.optIcon, { backgroundColor: opt.bg }]}>
              <Feather name={opt.icon as any} size={22} color={opt.color} />
            </View>
            <View style={styles.optText}>
              <Text style={[styles.optTitle, { color: colors.foreground }]}>{opt.title}</Text>
              <Text style={[styles.optSubtitle, { color: colors.mutedForeground }]}>{opt.subtitle}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))}

        <View style={[styles.safeWordCard, CARD_SHADOW]}>
          <View style={styles.safeWordHeader}>
            <Feather name="key" size={16} color={colors.primary} />
            <Text style={[styles.safeWordTitle, { color: colors.foreground }]}>Safe Word</Text>
            {wordSaved && (
              <View style={[styles.savedBadge, { backgroundColor: "#ECFDF5" }]}>
                <Feather name="check" size={10} color="#059669" />
                <Text style={[styles.savedText, { color: "#059669" }]}>Saved</Text>
              </View>
            )}
          </View>
          <Text style={[styles.safeWordSub, { color: colors.mutedForeground }]}>
            Set a word that, if texted, auto-alerts your emergency contacts.
          </Text>
          <View style={styles.safeWordRow}>
            <TextInput
              style={[styles.safeWordInput, { backgroundColor: colors.muted, color: colors.foreground }]}
              placeholder="e.g. pineapple"
              placeholderTextColor={colors.mutedForeground}
              value={safeWord}
              onChangeText={setSafeWord}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: safeWord.trim() ? 1 : 0.4 }]}
              onPress={saveSafeWord}
              disabled={!safeWord.trim()}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.backBtn, { borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.backBtnText, { color: colors.mutedForeground }]}>I'm safe now — go back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: 14,
  },
  bannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 20 },
  content: { paddingHorizontal: 20, gap: 12, flex: 1 },
  optCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  optIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  optText: { flex: 1, gap: 3 },
  optTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  optSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  safeWordCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 10 },
  safeWordHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  safeWordTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  savedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  savedText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  safeWordSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  safeWordRow: { flexDirection: "row", gap: 10 },
  safeWordInput: { flex: 1, height: 42, borderRadius: 12, paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_400Regular" },
  saveBtn: { paddingHorizontal: 18, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  backBtn: { borderWidth: 1, borderRadius: 14, height: 48, alignItems: "center", justifyContent: "center", marginTop: 4 },
  backBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
