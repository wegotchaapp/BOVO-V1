import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Alert } from "@/lib/alert";
import { CARD_SHADOW, INK_ON_MUTED } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

/**
 * Edits the one contact Bovogo texts when an SOS is raised.
 *
 * This previously existed only as step 5 of onboarding, so anyone who skipped it
 * or mistyped a number could never fix it — and the Safety Center's "tap to add
 * one" row pointed at the travel-preferences wizard instead.
 */
export default function EmergencyContactScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, patchMe } = useAuth();

  const [name, setName] = useState(user?.emergencyName ?? "");
  const [phone, setPhone] = useState(user?.emergencyPhone ?? "");
  const [saving, setSaving] = useState(false);

  const digits = phone.replace(/\D/g, "");
  // Matches the onboarding gate, so the same contact is acceptable in both places.
  const valid = name.trim().length > 0 && digits.length >= 10;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await patchMe({
        emergencyName: name.trim(),
        emergencyPhone: phone.trim(),
      });
      router.back();
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Remove this contact?",
        "Nobody will be texted when you raise an SOS.",
        [
          { text: "Keep", style: "cancel", onPress: () => resolve(false) },
          { text: "Remove", style: "destructive", onPress: () => resolve(true) },
        ],
      );
    });
    if (!ok) return;
    setSaving(true);
    try {
      await patchMe({ emergencyName: "", emergencyPhone: "" });
      router.back();
    } catch (e: any) {
      Alert.alert("Couldn't remove", e?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Emergency Contact
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.blurb, { color: colors.mutedForeground }]}>
            When you hold SOS, we text this person your live location. They are the
            only person Bovogo contacts on your behalf.
          </Text>

          <View style={[styles.card, CARD_SHADOW]}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>NAME</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                  borderColor: name.trim() ? colors.primary : colors.border,
                },
              ]}
              placeholder="Who should we contact?"
              placeholderTextColor={INK_ON_MUTED}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 18 }]}>
              PHONE
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                  borderColor: digits.length >= 10 ? colors.primary : colors.border,
                },
              ]}
              placeholder="(512) 555-0100"
              placeholderTextColor={INK_ON_MUTED}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            {phone.length > 0 && digits.length < 10 ? (
              <Text style={[styles.hint, { color: colors.destructive }]}>
                That needs to be a full 10-digit number.
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: valid ? colors.primary : colors.muted },
            ]}
            onPress={save}
            disabled={!valid || saving}
            activeOpacity={0.88}
          >
            {saving ? (
              <ActivityIndicator color={valid ? "#fff" : colors.primary} />
            ) : (
              <Text
                style={[styles.saveText, { color: valid ? "#fff" : INK_ON_MUTED }]}
              >
                Save contact
              </Text>
            )}
          </TouchableOpacity>

          {user?.emergencyName ? (
            <TouchableOpacity onPress={clear} disabled={saving} style={styles.clearBtn}>
              <Text style={[styles.clearText, { color: colors.destructive }]}>
                Remove contact
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  content: { paddingHorizontal: 22, paddingBottom: 40, gap: 18 },
  blurb: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  input: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  hint: { marginTop: 8, fontSize: 12, fontFamily: "Inter_400Regular" },
  saveBtn: {
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  clearBtn: { alignItems: "center", paddingVertical: 12 },
  clearText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
