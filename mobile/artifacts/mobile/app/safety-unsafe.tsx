import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Keyboard,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Alert } from "@/lib/alert";

import { CARD_SHADOW } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { MANUAL_CALL_911_MESSAGE, openDialer, triggerSos } from "@/lib/safety";
import { shareLiveLocation } from "@/lib/share";
import { useAuth } from "@/context/AuthContext";

const OPTIONS = [
  {
    id: "record",
    icon: "mic",
    title: "Record Silently",
    subtitle: "Not available yet — use your phone's recorder",
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
  const { user } = useAuth();
  const emergencyName = user?.emergencyName?.trim() ?? "";
  const emergencyPhone = user?.emergencyPhone?.trim() ?? "";
  const [safeWord, setSafeWord] = useState("");
  const [wordSaved, setWordSaved] = useState(false);

  function handleOption(id: string) {
    if (id === "911") {
      // Real SOS: emergency-contact SMS via backend + 911 text composer + dialer.
      triggerSos({
        onManualCall: () => Alert.alert("Call 911 yourself", MANUAL_CALL_911_MESSAGE),
      }).catch(() => {
        Alert.alert("SOS", "Couldn't open the dialer automatically. Please call 911 directly.");
      });
    } else if (id === "record") {
      // Not built. It previously reported "Silent recording is running", which is
      // the most dangerous thing this screen could say — someone in trouble could
      // rely on evidence that was never captured.
      Alert.alert(
        "Recording isn't available yet",
        "Bovogo can't record audio for you. Use your phone's own recorder, or send your location and call for help below.",
      );
    } else if (id === "share") {
      shareLiveLocation({ contactName: emergencyName })
        .then((shared) => {
          if (!shared) {
            Alert.alert(
              "Location unavailable",
              "We couldn't get a GPS fix. Check that location access is enabled for Bovogo.",
            );
          }
        })
        .catch(() => {
          Alert.alert("Couldn't share", "Please try again.");
        });
    } else if (id === "contact") {
      if (!emergencyPhone) {
        Alert.alert(
          "No emergency contact saved",
          "Add one in the Safety Center so you can reach them in one tap.",
        );
        return;
      }
      // The result is the only signal available: on web `Linking` resolves and
      // reports success whatever happens, so a `.catch` here would never fire.
      openDialer(emergencyPhone).then((result) => {
        if (result === "opened") return;
        Alert.alert(
          "Call them from your phone",
          `Call ${emergencyName || "your emergency contact"} on ${emergencyPhone}.`,
        );
      });
    }
  }

  function saveSafeWord() {
    Keyboard.dismiss();
    if (!safeWord.trim()) return;
    setWordSaved(true);
    // The old copy promised Bovogo would watch for this word in your texts and
    // alert your contacts. That is not built, and on iOS an app cannot read your
    // outgoing messages at all — so it could never be true as written.
    Alert.alert(
      "Noted on this device",
      `"${safeWord.trim()}" is saved here only. Bovogo can't watch your messages — share the word with someone you trust so they know to call for help.`,
      [{ text: "Got it" }],
    );
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
          Nothing is sent automatically. Choose an action below.
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
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
            Not active yet. Bovogo can't watch your messages, so agree a word with someone you trust and text them directly.
          </Text>
          <View style={styles.safeWordRow}>
            <TextInput
              style={[styles.safeWordInput, { backgroundColor: colors.muted, color: colors.foreground }]}
              placeholder="e.g. pineapple"
              placeholderTextColor={colors.mutedForeground}
              value={safeWord}
              onChangeText={setSafeWord}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={saveSafeWord}
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
      </ScrollView>
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
