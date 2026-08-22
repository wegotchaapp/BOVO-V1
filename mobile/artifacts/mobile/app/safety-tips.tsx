import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { CARD_SHADOW } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";

interface Tip {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
}

const BEFORE: Tip[] = [
  {
    icon: "user-check",
    title: "Match the face and the plate",
    body: "Your Voyager's photo, vehicle, colour and licence plate are all in the app. Check every one before you open the door — if any of them don't match, don't get in.",
  },
  {
    icon: "share-2",
    title: "Share your adventure",
    body: "Send your live route and ETA to someone you trust from the Safety Center. They'll be able to follow your position for the whole adventure.",
  },
  {
    icon: "battery-charging",
    title: "Start with a charged phone",
    body: "Live tracking, SOS and your booking details all need battery. Bring a cable for longer routes.",
  },
];

const DURING: Tip[] = [
  {
    icon: "map-pin",
    title: "Sit where you're comfortable",
    body: "The back seat gives you space and two exits. You're never obliged to sit up front.",
  },
  {
    icon: "message-circle",
    title: "Keep it in the app",
    body: "Messages and calls through Bovogo stay logged and are never shared with your personal number. Keep conversations here so we can help if something goes wrong.",
  },
  {
    icon: "alert-triangle",
    title: "Trust your instincts",
    body: "You can end an adventure at any point, for any reason, without explaining yourself. Use 'I Feel Unsafe' for discreet options including silent recording.",
  },
];

const AFTER: Tip[] = [
  {
    icon: "star",
    title: "Rate honestly",
    body: "Ratings are how the community stays safe. Low ratings and written reports both reach our Trust & Safety team.",
  },
  {
    icon: "flag",
    title: "Report anything that felt wrong",
    body: "Even if nothing happened, tell us. Patterns across reports are what let us act before someone gets hurt.",
  },
];

function Section({ title, tips }: { title: string; tips: Tip[] }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      {tips.map((tip) => (
        <View key={tip.title} style={[styles.card, CARD_SHADOW, { backgroundColor: colors.card }]}>
          <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
            <Feather name={tip.icon} size={18} color={colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{tip.title}</Text>
            <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>{tip.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function SafetyTips() {
  const colors = useColors();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <Text
          onPress={() => router.back()}
          style={[styles.headerBtn, { color: colors.foreground }]}
          accessibilityRole="button"
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Text>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Safety Tips</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="BEFORE YOU GO" tips={BEFORE} />
        <Section title="ON THE ROAD" tips={DURING} />
        <Section title="AFTER YOU ARRIVE" tips={AFTER} />

        <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
          <Feather name="phone" size={14} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.primary }]}>
            In an emergency, always call 911 first. The SOS button in the Safety Center
            alerts your emergency contact and our safety team at the same time.
          </Text>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerBtn: { width: 40, height: 40, textAlign: "center", lineHeight: 40 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 8 },
  section: { gap: 12, marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginTop: 8,
  },
  card: { flexDirection: "row", gap: 14, padding: 16, borderRadius: 16 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardText: { flex: 1, gap: 5 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 14, borderRadius: 14 },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
