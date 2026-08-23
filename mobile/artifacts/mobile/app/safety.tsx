import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Linking,
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

import { Alert } from "@/lib/alert";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { CARD_SHADOW, INK_ON_MUTED } from "@/constants/colors";
import {
  getSosLocation,
  hasLocationPermission,
  triggerSos,
  type SosLocationFailure,
  type SosOutcome,
} from "@/lib/safety";
import { shareLiveLocation } from "@/lib/share";

const HOLD_DURATION = 3000;
const COUNTDOWN_SECONDS = 10;

export default function Safety() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const emergencyName = user?.emergencyName?.trim() ?? "";
  const emergencyPhone = user?.emergencyPhone?.trim() ?? "";
  const [sharing, setSharing] = useState(false);
  // Checked without prompting, so the gap is visible before an emergency rather
  // than discovered during one.
  const [locationBlocked, setLocationBlocked] = useState(false);

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
          dispatchSOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function dispatchSOS() {
    // Auto-texts the emergency contact with live location, then opens the 911
    // text composer and dialer (the OS requires one tap from the user).
    try {
      // Reported through onResult rather than the resolved promise: the 911
      // handoff that follows can navigate away or background the app, and this
      // has to reach the user either way.
      await triggerSos({
        onResult: reportSosOutcome,
        onNoLocation: reportNoLocation,
      });
    } catch {
      Alert.alert(
        "SOS",
        "We couldn't open your phone's dialer automatically. Please call 911 directly.",
      );
    }
  }

  /**
   * Known before any network call, so this is the one warning guaranteed to be
   * on screen before the 911 handoff takes the app away.
   */
  function reportNoLocation(reason: SosLocationFailure) {
    setLocationBlocked(reason === "permission_denied");
    Alert.alert(
      "No responders were sent",
      reason === "permission_denied"
        ? "Bovogo couldn't get your location, so we couldn't dispatch anyone. Your phone's 911 call is still the fastest route — turn on location access to let us dispatch next time."
        : "We couldn't get a location fix, so we couldn't dispatch anyone. Use the 911 call your phone just opened.",
    );
  }

  function reportSosOutcome(result: SosOutcome) {
    setLocationBlocked(result.locationReason === "permission_denied");

    // Already reported by reportNoLocation, before the handoff.
    if (result.locationReason) return;

    // Dispatch needs coordinates — Noonlight cannot open an alarm without them
    // — so without a location nobody is sent. That is the one outcome the user
    // must not be left assuming went the other way.
    if (!result.dispatched) {
      Alert.alert(
        "No responders were sent",
        "We couldn't reach the dispatch service. Use the 911 call your phone just opened.",
      );
      return;
    }

    // Say so when the contact was not reached. Believing someone has been
    // alerted when they have not is worse than knowing you are on your own.
    if (!result.contactNotified) {
      Alert.alert(
        "Your emergency contact wasn't alerted",
        result.reason === "no_emergency_contact"
          ? "You haven't saved one yet. Reach someone directly, then add a contact in the Safety Center."
          : "We couldn't get the message out. Call them directly if you can.",
      );
    }
  }

  async function openLocationSettings() {
    // Asking again is a no-op once the OS has recorded a denial, so send the
    // user to Settings when the prompt is spent.
    const granted = await hasLocationPermission();
    if (granted) {
      setLocationBlocked(false);
      return;
    }
    const fresh = await getSosLocation();
    if (fresh.coord) {
      setLocationBlocked(false);
      return;
    }
    Linking.openSettings().catch(() => {
      Alert.alert(
        "Turn on location",
        "Open Settings, find Bovogo, and allow location access so an SOS can dispatch responders.",
      );
    });
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

  useEffect(() => {
    let cancelled = false;
    hasLocationPermission().then((granted) => {
      if (!cancelled) setLocationBlocked(!granted);
    });
    return () => { cancelled = true; };
  }, []);

  const progressDeg = holdProgress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  /** Real OS share sheet carrying an actual GPS fix, not a canned message. */
  async function handleShareLive() {
    if (sharing) return;
    setSharing(true);
    try {
      const shared = await shareLiveLocation({ contactName: emergencyName });
      if (!shared) {
        Alert.alert(
          "Location unavailable",
          "We couldn't get a GPS fix. Check that location access is enabled for Bovogo and try again.",
        );
      }
    } catch (e: any) {
      Alert.alert("Couldn't share", e?.message ?? "Please try again.");
    } finally {
      setSharing(false);
    }
  }

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
      subtitle: sharing ? "Getting your location…" : "Send your route + ETA to a contact",
      onPress: handleShareLive,
      color: colors.primary,
      bg: colors.secondary,
    },
    {
      icon: "phone",
      title: "Emergency Contact",
      // Reflects the contact actually on file rather than a hardcoded count.
      subtitle: emergencyName
        ? `${emergencyName} · ${emergencyPhone || "no number saved"}`
        : "None saved — tap to add one",
      onPress: () => router.push("/emergency-contact" as any),
      // This row goes amber precisely to flag the missing contact, so the glyph
      // is carrying state, not decoration. #D97706 is 2.90:1 on the pale fill,
      // under the 3:1 floor; this is 3.79:1.
      color: emergencyName ? colors.primary : "#C2620A",
      bg: emergencyName ? colors.secondary : "#FEF3E2",
    },
    {
      icon: "book-open",
      title: "Safety Tips",
      subtitle: "Best practices for safe carpooling",
      onPress: () => router.push("/safety-tips" as any),
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

          {/* The contact half of this promise is only true if one is saved, and
              the row two below already says when none is. `notifyEmergencyContacts`
              alerts opted-in contacts, so with none it tells nobody. */}
          <Text style={[styles.sosNote, { color: colors.mutedForeground }]}>
            {emergencyName
              ? `Texts and calls 911 with your location, and alerts ${emergencyName}.`
              : "Texts and calls 911 with your location. Add an emergency contact below and we'll alert them too."}
          </Text>

          {/* Without coordinates no alarm can be opened, so this is worth
              knowing now rather than in the middle of an emergency. */}
          {locationBlocked && (
            <TouchableOpacity
              style={[styles.locationWarning, { backgroundColor: "#FEF3E2" }]}
              onPress={openLocationSettings}
              activeOpacity={0.85}
            >
              <Feather name="map-pin" size={15} color="#7A5A1E" />
              <Text style={[styles.locationWarningText, { color: "#7A5A1E" }]}>
                Location is off, so an SOS can't dispatch responders. Tap to turn it on.
              </Text>
            </TouchableOpacity>
          )}
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

        {/* Stated conditionally: with location off there is no GPS tracking to
            speak of, and claiming otherwise directly contradicts the warning
            further up this same screen. */}
        <View
          style={[
            styles.notice,
            { backgroundColor: locationBlocked ? colors.muted : colors.secondary },
          ]}
        >
          <Feather
            name={locationBlocked ? "shield-off" : "shield"}
            size={14}
            color={locationBlocked ? INK_ON_MUTED : colors.primary}
          />
          <Text
            style={[
              styles.noticeText,
              { color: locationBlocked ? INK_ON_MUTED : colors.primary },
            ]}
          >
            {locationBlocked
              ? "Bovogo monitors live adventures for safety, but GPS tracking is off on this device."
              : "Bovogo monitors live adventures for safety. GPS tracking is active during your adventure."}
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
  locationWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 14,
  },
  locationWarningText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
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
