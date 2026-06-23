import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";

const HOLD_DURATION = 3000;
const COUNTDOWN_SECONDS = 10;

export default function Safety() {
  const colors = useColors();
  const router = useRouter();

  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdAnim = useRef<Animated.CompositeAnimation | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [sosTriggered, setSosTriggered] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scale = holdProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] });
  const glowOpacity = holdProgress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  function onHoldStart() {
    setIsHolding(true);
    holdAnim.current = Animated.timing(holdProgress, {
      toValue: 1,
      duration: HOLD_DURATION,
      useNativeDriver: false,
    });
    holdAnim.current.start(({ finished }) => {
      if (finished) triggerSOS();
    });
  }

  function onHoldEnd() {
    setIsHolding(false);
    holdAnim.current?.stop();
    Animated.spring(holdProgress, { toValue: 0, useNativeDriver: false, speed: 20 }).start();
  }

  function triggerSOS() {
    setSosTriggered(true);
    setCountdown(COUNTDOWN_SECONDS);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          setSosTriggered(false);
          holdProgress.setValue(0);
          Alert.alert(
            "SOS Dispatched",
            "Your location and trip details have been sent to your emergency contacts and Bovogo safety team. If you're in immediate danger, call 911.",
            [{ text: "OK" }],
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function cancelSOS() {
    clearInterval(countdownRef.current!);
    setSosTriggered(false);
    holdProgress.setValue(0);
    setIsHolding(false);
  }

  useEffect(() => {
    return () => { clearInterval(countdownRef.current!); };
  }, []);

  const progressDeg = holdProgress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const actions = [
    {
      icon: "alert-triangle",
      title: "I Feel Unsafe",
      subtitle: "Access discreet safety options",
      onPress: () => router.push("/safety-unsafe" as any),
      color: "#DC2626",
      bg: "#FEF2F2",
    },
    {
      icon: "share-2",
      title: "Share Live Adventure",
      subtitle: "Send your route + ETA to a contact",
      onPress: () => Alert.alert("Share Adventure", "Sharing your live adventure link with your emergency contact."),
      color: colors.primary,
      bg: colors.secondary,
    },
    {
      icon: "phone",
      title: "Emergency Contacts",
      subtitle: "3 contacts added and ready",
      onPress: () => Alert.alert("Emergency Contacts", "Contact management available in Settings."),
      color: colors.primary,
      bg: colors.secondary,
    },
    {
      icon: "book-open",
      title: "Safety Tips",
      subtitle: "Best practices for safe carpooling",
      onPress: () =>
        Alert.alert(
          "Safety Tips",
          "1. Verify driver's ID before boarding.\n2. Share your trip with a trusted contact.\n3. Sit in the back seat.\n4. Trust your instincts — cancel if uncomfortable.\n5. Keep your phone charged.",
        ),
      color: colors.primary,
      bg: colors.secondary,
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Safety Center</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sosSection}>
          <Text style={[styles.sosInstruction, { color: colors.mutedForeground }]}>
            Hold for 3 seconds to activate SOS
          </Text>

          <View style={styles.sosOuter}>
            <Animated.View
              style={[
                styles.sosGlow,
                { opacity: isHolding ? glowOpacity : 0.25 },
              ]}
            />
            <Pressable
              onPressIn={onHoldStart}
              onPressOut={onHoldEnd}
              style={styles.sosPressable}
            >
              <Animated.View style={[styles.sosBtn, { transform: [{ scale }] }]}>
                <Text style={styles.sosLabel}>SOS</Text>
                <Text style={styles.sosSubtext}>
                  {isHolding ? "Keep holding..." : "Hold 3 sec"}
                </Text>
                {isHolding && (
                  <View style={styles.holdProgressTrack}>
                    <Animated.View
                      style={[
                        styles.holdProgressFill,
                        {
                          flex: holdProgress,
                          backgroundColor: "rgba(255,255,255,0.6)",
                        },
                      ]}
                    />
                  </View>
                )}
              </Animated.View>
            </Pressable>
          </View>

          <Text style={[styles.sosNote, { color: colors.mutedForeground }]}>
            Alerts your emergency contacts + Bovogo safety team
          </Text>
        </View>

        <View style={styles.actions}>
          {actions.map((a) => (
            <TouchableOpacity
              key={a.title}
              style={[styles.actionItem, CARD_SHADOW]}
              onPress={a.onPress}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
                <Feather name={a.icon as any} size={20} color={a.color} />
              </View>
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: a.title === "I Feel Unsafe" ? "#DC2626" : colors.foreground }]}>
                  {a.title}
                </Text>
                <Text style={[styles.actionSubtitle, { color: colors.mutedForeground }]}>{a.subtitle}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
          <Feather name="shield" size={14} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.primary }]}>
            Bovogo monitors all live trips for safety. GPS tracking is active during your ride.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={sosTriggered} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.sosModal}>
            <View style={styles.sosModalIcon}>
              <Feather name="alert-octagon" size={36} color="#fff" />
            </View>
            <Text style={styles.sosModalTitle}>SOS Activating</Text>
            <Text style={styles.sosModalCountdown}>{countdown}</Text>
            <Text style={styles.sosModalSub}>
              Your emergency contacts will be notified in {countdown} second{countdown !== 1 ? "s" : ""}.
            </Text>
            <Text style={styles.sosModalSub} numberOfLines={1}>
              Your GPS location is being shared.
            </Text>
            <TouchableOpacity style={styles.cancelSOS} onPress={cancelSOS}>
              <Text style={styles.cancelSOSText}>Cancel — I'm Safe</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 24 },
  sosSection: { alignItems: "center", gap: 14 },
  sosInstruction: { fontSize: 13, fontFamily: "Inter_500Medium" },
  sosOuter: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
  sosGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#DC2626",
  },
  sosPressable: { width: 170, height: 170, borderRadius: 85 },
  sosBtn: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    overflow: "hidden",
  },
  sosLabel: { color: "#fff", fontSize: 38, fontFamily: "Inter_700Bold", letterSpacing: 2 },
  sosSubtext: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "Inter_500Medium" },
  holdProgressTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 6,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  holdProgressFill: { height: 6 },
  sosNote: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  actions: { gap: 12 },
  actionItem: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    gap: 14,
  },
  actionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionText: { flex: 1, gap: 3 },
  actionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  actionSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 14,
    borderRadius: 14,
  },
  noticeText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center" },
  sosModal: {
    backgroundColor: "#DC2626",
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    gap: 14,
    marginHorizontal: 32,
    width: "85%",
  },
  sosModalIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  sosModalTitle: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  sosModalCountdown: { color: "#fff", fontSize: 72, fontFamily: "Inter_700Bold", letterSpacing: -2 },
  sosModalSub: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  cancelSOS: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  cancelSOSText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
