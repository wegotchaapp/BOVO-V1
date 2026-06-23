import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface VerifyItem {
  icon: string;
  title: string;
  subtitle: string;
  status: "pending" | "done" | "placeholder";
}

const ITEMS: VerifyItem[] = [
  {
    icon: "credit-card",
    title: "Government ID",
    subtitle: "Upload your valid ID",
    status: "done",
  },
  {
    icon: "camera",
    title: "Selfie Verification",
    subtitle: "Take a quick selfie",
    status: "done",
  },
  {
    icon: "shield",
    title: "Background Check",
    subtitle: "For your safety (coming soon)",
    status: "placeholder",
  },
];

export default function Verify() {
  const colors = useColors();
  const router = useRouter();
  const [tapped, setTapped] = useState<Record<number, boolean>>({});

  function handleItem(idx: number) {
    if (ITEMS[idx].status === "placeholder") {
      Alert.alert(
        "Coming Soon",
        "Background checks will be enabled before launch. You can continue for now.",
      );
      return;
    }
    setTapped((prev) => ({ ...prev, [idx]: true }));
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: Platform.OS === "web" ? 67 : 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.foreground }]}>Verify Your Identity</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          We need to verify it's you.
        </Text>

        <View style={styles.items}>
          {ITEMS.map((item, idx) => {
            const isDone = tapped[idx] || item.status === "done";
            const isPlaceholder = item.status === "placeholder";
            return (
              <TouchableOpacity
                key={item.title}
                style={[
                  styles.item,
                  {
                    backgroundColor: colors.card,
                    borderColor: isDone ? colors.primary : colors.border,
                    borderWidth: isDone ? 1.5 : 1,
                    opacity: isPlaceholder ? 0.65 : 1,
                  },
                ]}
                onPress={() => handleItem(idx)}
                activeOpacity={0.75}
              >
                <View style={[styles.itemIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name={item.icon as any} size={20} color={colors.primary} />
                </View>
                <View style={styles.itemText}>
                  <Text style={[styles.itemTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.itemSubtitle, { color: colors.mutedForeground }]}>
                    {item.subtitle}
                  </Text>
                </View>
                <View
                  style={[
                    styles.check,
                    { backgroundColor: isDone ? colors.primary : colors.muted },
                  ]}
                >
                  <Feather name="check" size={14} color={isDone ? "#fff" : colors.mutedForeground} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
          <Feather name="lock" size={16} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.primary }]}>
            Your data is secure and encrypted
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 32 }]}
          onPress={() => router.push("/onboarding")}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 24, paddingBottom: 48 },
  back: { marginBottom: 24 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 6 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 28 },
  items: { gap: 12 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    gap: 14,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: { flex: 1, gap: 3 },
  itemTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  itemSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  noticeText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  primaryBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
