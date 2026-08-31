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

import { useColors } from "@/hooks/useColors";

interface VerifyItem {
  icon: string;
  title: string;
  subtitle: string;
  /** Where the check actually runs. Absent means it isn't built yet. */
  href?: string;
}

const ITEMS: VerifyItem[] = [
  {
    icon: "credit-card",
    title: "Government ID",
    subtitle: "Not available yet — Bovogo can't check IDs today",
  },
  {
    icon: "camera",
    title: "Selfie Verification",
    subtitle: "Not available yet",
  },
  {
    icon: "shield",
    title: "Background Check",
    subtitle: "Run by Checkr before you can post an adventure",
    href: "/vehicle",
  },
];

export default function Verify() {
  const colors = useColors();
  const router = useRouter();

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

        <Text style={[styles.title, { color: colors.foreground }]}>Identity Checks</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          What Bovogo can check today, and what it can't yet.
        </Text>

        <View style={styles.items}>
          {ITEMS.map((item) => {
            const live = !!item.href;
            return (
              <TouchableOpacity
                key={item.title}
                style={[
                  styles.item,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                    opacity: live ? 1 : 0.65,
                  },
                ]}
                onPress={() => item.href && router.push(item.href as any)}
                disabled={!live}
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
                {live ? (
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.primary }]}>
            Nothing on this screen has been submitted. Don't treat another
            Bovogo member as ID-checked — no one is, yet.
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
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  noticeText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 19 },
  primaryBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
