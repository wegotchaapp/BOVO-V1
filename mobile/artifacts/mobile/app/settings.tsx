import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Alert } from "@/lib/alert";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, cancelAccountDeletion, deletionScheduledAt } = useAuth();

  async function handleCancelDeletion() {
    try {
      await cancelAccountDeletion();
      Alert.alert("Deletion cancelled", "Your account will remain active.");
    } catch (e: any) {
      Alert.alert("Couldn't cancel", e?.message ?? "Please try again.");
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, CARD_SHADOW]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>{user?.name}</Text>
          <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{user?.email}</Text>
          {user?.phone ? (
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{user.phone}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.card, CARD_SHADOW, styles.menuRow]}
          onPress={() => router.push("/notifications")}
          activeOpacity={0.85}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
            <Feather name="bell" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: colors.foreground }]}>Notifications</Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              Push, email, and trip alerts
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, CARD_SHADOW, styles.menuRow]}
          onPress={() => router.push("/preferences")}
          activeOpacity={0.85}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
            <Feather name="sliders" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: colors.foreground }]}>
              Travel preferences
            </Text>
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
              {user?.preferencesCount
                ? `${user.preferencesCount} of 10 set`
                : "Set your travel preferences"}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <View style={[styles.card, CARD_SHADOW]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PRIVACY</Text>
          <Text style={[styles.privacyText, { color: colors.foreground }]}>
            You can request account deletion from your profile. Bovogo keeps data for a 7-day
            grace period (CCPA), then permanently erases it from our servers.
          </Text>
          {deletionScheduledAt ? (
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.secondary }]}
              onPress={handleCancelDeletion}
            >
              <Text style={[styles.cancelBtnText, { color: colors.primary }]}>
                Cancel scheduled deletion
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, gap: 6 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  rowLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  privacyText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  cancelBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
