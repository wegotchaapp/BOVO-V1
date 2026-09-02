import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Alert } from "@/lib/alert";

import { useAuth, type NotificationSettings } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";

const ROWS: {
  key: keyof NotificationSettings;
  label: string;
  sub: string;
}[] = [
  {
    key: "pushEnabled",
    label: "Push notifications",
    sub: "Alerts on this device",
  },
  {
    key: "emailEnabled",
    label: "Email updates",
    sub: "Booking and account emails",
  },
  {
    key: "tripUpdates",
    label: "Adventure updates",
    sub: "Departures, delays, and cancellations",
  },
  {
    key: "messages",
    label: "Messages",
    sub: "New chat and group messages",
  },
  {
    key: "marketing",
    label: "Tips & offers",
    sub: "Occasional product news",
  },
];

export default function NotificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, updateNotificationSettings } = useAuth();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const settings: NotificationSettings = user?.notificationSettings ?? {
    pushEnabled: true,
    emailEnabled: true,
    tripUpdates: true,
    marketing: false,
    messages: true,
  };

  async function toggle(key: keyof NotificationSettings, value: boolean) {
    setSavingKey(key);
    try {
      await updateNotificationSettings({ [key]: value });
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message ?? "Please try again.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Notifications
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, CARD_SHADOW]}>
          {ROWS.map((row, i) => (
            <View key={row.key}>
              {i > 0 ? (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              ) : null}
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.label, { color: colors.foreground }]}>
                    {row.label}
                  </Text>
                  <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                    {row.sub}
                  </Text>
                </View>
                <Switch
                  value={settings[row.key]}
                  onValueChange={(v) => toggle(row.key, v)}
                  disabled={savingKey === row.key}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                />
              </View>
            </View>
          ))}
        </View>
        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          Preferences are saved to your Bovogo account and apply on every device.
        </Text>
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
  scroll: { padding: 20, gap: 14 },
  card: { backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  divider: { height: 1 },
  label: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  note: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, paddingHorizontal: 4 },
});
