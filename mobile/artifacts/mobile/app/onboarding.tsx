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

import { useAuth, type UserRole } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";

const LANGUAGES = ["English", "Spanish", "Hindi", "Mandarin", "Arabic", "French", "Portuguese", "Vietnamese"];

const STEPS = ["Photo", "Name", "Bio", "Languages", "Emergency", "Role"];

export default function Onboarding() {
  const colors = useColors();
  const router = useRouter();
  const { setRole, completeOnboarding } = useAuth();

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [selected, setSelected] = useState<UserRole>(null);
  const [loading, setLoading] = useState(false);

  function toggleLanguage(lang: string) {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  }

  function canAdvance() {
    if (step === 1) return displayName.trim().length > 0;
    if (step === 4) return emergencyName.trim().length > 0 && emergencyPhone.trim().length >= 10;
    if (step === 5) return selected !== null;
    return true;
  }

  async function advance() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      if (!selected) return;
      setLoading(true);
      await setRole(selected);
      await completeOnboarding();
      setLoading(false);
      router.replace("/(tabs)");
    }
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  const progress = (step / (STEPS.length - 1)) * 100;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 16 }]}>
        <TouchableOpacity onPress={step === 0 ? () => router.back() : back} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress}%` as any }]} />
        </View>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>
          {step + 1}/{STEPS.length}
        </Text>
      </View>

      <View style={styles.content}>
        {step === 0 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Add Your Photo</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              A profile photo builds trust with other riders and drivers.
            </Text>
            <TouchableOpacity
              style={[styles.avatarUpload, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={() => Alert.alert("Photo Upload", "Camera access will be available at launch.")}
              activeOpacity={0.8}
            >
              <Feather name="camera" size={36} color={colors.primary} />
              <Text style={[styles.uploadText, { color: colors.primary }]}>Tap to add photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.skipLink]}
              onPress={() => setStep(step + 1)}
            >
              <Text style={[styles.skipLinkText, { color: colors.mutedForeground }]}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>What's your name?</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              This is how you'll appear to other users. Use a real name or nickname.
            </Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: displayName ? colors.primary : colors.border }]}
              placeholder="Display name"
              placeholderTextColor={colors.mutedForeground}
              value={displayName}
              onChangeText={setDisplayName}
              autoFocus
              maxLength={40}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Tell us about you</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              A short bio helps others feel comfortable riding with you.
            </Text>
            <TextInput
              style={[styles.bioInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
              placeholder="e.g. UT Austin grad. Love road trips and good podcasts. Non-smoker."
              placeholderTextColor={colors.mutedForeground}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              maxLength={200}
              autoFocus
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{bio.length}/200</Text>
            <TouchableOpacity style={styles.skipLink} onPress={() => setStep(step + 1)}>
              <Text style={[styles.skipLinkText, { color: colors.mutedForeground }]}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Languages you speak</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Select all that apply. This helps match compatible travel partners.
            </Text>
            <View style={styles.langGrid}>
              {LANGUAGES.map((lang) => {
                const sel = languages.includes(lang);
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[
                      styles.langChip,
                      {
                        backgroundColor: sel ? colors.secondary : colors.card,
                        borderColor: sel ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => toggleLanguage(lang)}
                  >
                    <Feather name={sel ? "check-circle" : "circle"} size={14} color={sel ? colors.primary : colors.border} />
                    <Text style={[styles.langText, { color: sel ? colors.primary : colors.foreground }]}>{lang}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>Emergency Contact</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              We'll notify this person if SOS is activated during a trip. Keep them close.
            </Text>
            <View style={[styles.emergencyCard, CARD_SHADOW]}>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: emergencyName ? colors.primary : colors.border }]}
                placeholder="Contact name"
                placeholderTextColor={colors.mutedForeground}
                value={emergencyName}
                onChangeText={setEmergencyName}
                maxLength={50}
              />
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: emergencyPhone ? colors.primary : colors.border, marginTop: 12 }]}
                placeholder="Phone number (e.g. 555-867-5309)"
                placeholderTextColor={colors.mutedForeground}
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
            <View style={[styles.infoNote, { backgroundColor: colors.secondary }]}>
              <Feather name="shield" size={13} color={colors.primary} />
              <Text style={[styles.infoNoteText, { color: colors.primary }]}>
                Your contact's info is encrypted and never shared with drivers or riders.
              </Text>
            </View>
          </View>
        )}

        {step === 5 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>How will you use Bovogo?</Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              You can always switch roles later from your profile.
            </Text>
            <View style={styles.roleOptions}>
              {(
                [
                  { role: "rider", icon: "user", title: "Sailor" },
                  { role: "driver", icon: "truck", title: "Voyager" },
                ] as const
              ).map((opt) => {
                const isSelected = selected === opt.role;
                return (
                  <TouchableOpacity
                    key={opt.role}
                    style={[
                      styles.roleCard,
                      {
                        backgroundColor: isSelected ? colors.secondary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => setSelected(opt.role)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.roleCardTop}>
                      <View style={[styles.roleIcon, { backgroundColor: isSelected ? colors.primary : colors.muted }]}>
                        <Feather name={opt.icon} size={22} color={isSelected ? "#fff" : colors.mutedForeground} />
                      </View>
                      <View style={[styles.radio, { borderColor: isSelected ? colors.primary : colors.border }]}>
                        {isSelected && <View style={[styles.radioFill, { backgroundColor: colors.primary }]} />}
                      </View>
                    </View>
                    <Text style={[styles.roleTitle, { color: colors.foreground }]}>{opt.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.continueBtn,
            { backgroundColor: canAdvance() ? colors.primary : colors.muted },
          ]}
          onPress={advance}
          disabled={!canAdvance() || loading}
          activeOpacity={0.88}
        >
          <Text style={[styles.continueBtnText, { color: canAdvance() ? "#fff" : colors.mutedForeground }]}>
            {loading ? "Setting up..." : step === STEPS.length - 1 ? "Get Started" : "Continue"}
          </Text>
          {!loading && <Feather name="arrow-right" size={18} color={canAdvance() ? "#fff" : colors.mutedForeground} />}
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  stepLabel: { fontSize: 12, fontFamily: "Inter_500Medium", minWidth: 28 },
  content: { flex: 1, paddingHorizontal: 24 },
  stepContainer: { flex: 1, gap: 16 },
  stepTitle: { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginTop: 8 },
  stepSub: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  avatarUpload: {
    alignSelf: "center",
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    marginTop: 20,
  },
  uploadText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  textInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  bioInput: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    minHeight: 120,
    textAlignVertical: "top",
  },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },
  langGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  langText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  emergencyCard: { backgroundColor: "#fff", borderRadius: 18, padding: 18 },
  infoNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12 },
  infoNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  roleOptions: { gap: 14, flex: 1 },
  roleCard: { padding: 20, borderRadius: 18, gap: 10 },
  roleCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  roleIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioFill: { width: 10, height: 10, borderRadius: 5 },
  roleTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  roleDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  skipLink: { alignItems: "center", paddingVertical: 6 },
  skipLinkText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 32 : 24,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  continueBtn: {
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  continueBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
