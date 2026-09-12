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

import { CARD_SHADOW } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { MANUAL_CALL_911_MESSAGE, openDialer, triggerSos } from "@/lib/safety";
import { shareLiveLocation } from "@/lib/share";
import { useAuth } from "@/context/AuthContext";

const OPTIONS = [
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

  function handleOption(id: string) {
    if (id === "911") {
      // Real SOS: emergency-contact SMS via backend + 911 text composer + dialer.
      triggerSos({
        onManualCall: () => Alert.alert("Call 911 yourself", MANUAL_CALL_911_MESSAGE),
      }).catch(() => {
        Alert.alert("SOS", "Couldn't open the dialer automatically. Please call 911 directly.");
      });
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
  backBtn: { borderWidth: 1, borderRadius: 14, height: 48, alignItems: "center", justifyContent: "center", marginTop: 4 },
  backBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
