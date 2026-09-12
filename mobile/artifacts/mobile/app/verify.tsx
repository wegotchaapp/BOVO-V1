import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Alert, showSuccess } from "@/lib/alert";

import { CARD_SHADOW } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { ApiError } from "@/lib/api";
import {
  getIdentityVerification,
  ID_DOCUMENT_TYPES,
  needsBackImage,
  submitIdentityVerification,
  type IdDocumentType,
  type IdentityVerification,
} from "@/lib/identity";

type Slot = "idFront" | "idBack" | "selfie";
type FeatherName = React.ComponentProps<typeof Feather>["name"];

const SLOTS: { slot: Slot; label: string; hint: string; icon: FeatherName }[] = [
  { slot: "idFront", label: "Front of your ID", hint: "All four corners in frame, no glare", icon: "credit-card" },
  { slot: "idBack", label: "Back of your ID", hint: "The barcode side, in focus", icon: "credit-card" },
  { slot: "selfie", label: "A selfie", hint: "Your face, well lit, no sunglasses", icon: "user" },
];

const NO_FILES: Record<Slot, string | null> = { idFront: null, idBack: null, selfie: null };

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Module scope keeps the component identity stable across renders.
function StatusCard({
  tone,
  icon,
  title,
  sub,
}: {
  tone: "good" | "wait" | "bad";
  icon: FeatherName;
  title: string;
  sub: string;
}) {
  const colors = useColors();
  const skin =
    tone === "good"
      ? { bg: "#ECFDF5", ink: "#059669" }
      : tone === "bad"
        ? { bg: "#FEF2F2", ink: "#DC2626" }
        : { bg: colors.card, ink: "#D97706" };
  return (
    <View style={[styles.statusCard, CARD_SHADOW, { backgroundColor: skin.bg }]}>
      <Feather name={icon} size={22} color={skin.ink} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.statusTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>{sub}</Text>
      </View>
    </View>
  );
}

/**
 * Government ID and selfie upload, reached from Settings. It used to sit in the
 * sign-up flow as two rows that did nothing; a person on the Bovogo team now
 * reviews each submission in the admin dashboard.
 */
export default function IdentityVerificationScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, refreshMe } = useAuth();

  const [verification, setVerification] = useState<IdentityVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<IdDocumentType>("drivers_license");
  const [files, setFiles] = useState<Record<Slot, string | null>>(NO_FILES);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setVerification(await getIdentityVerification());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your verification.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Approval happens in the admin dashboard, so the cached profile can lag it.
  useEffect(() => {
    if (verification?.status === "approved" && user && !user.isVerified) void refreshMe();
  }, [verification?.status]);

  function setFile(slot: Slot, uri: string) {
    setFiles((prev) => ({ ...prev, [slot]: uri }));
  }

  async function fromCamera(slot: Slot) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera access needed", "Allow camera access for Bovogo to take this photo.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      cameraType: slot === "selfie" ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });
    if (!res.canceled) setFile(slot, res.assets[0].uri);
  }

  async function fromLibrary(slot: Slot) {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!res.canceled) setFile(slot, res.assets[0].uri);
  }

  function run(task: Promise<void>) {
    task.catch((e) => Alert.alert("Couldn't add that photo", e?.message ?? "Please try again."));
  }

  function pick(slot: Slot) {
    // No camera launcher on web; the file input still offers the camera on phones.
    if (Platform.OS === "web") return run(fromLibrary(slot));
    // A selfie has to be taken now — an old photo proves nothing.
    if (slot === "selfie") return run(fromCamera(slot));
    Alert.alert("Add a photo of your ID", "Take one now, or choose a photo you've already taken.", [
      { text: "Take photo", onPress: () => run(fromCamera(slot)) },
      { text: "Choose photo", onPress: () => run(fromLibrary(slot)) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  const backNeeded = needsBackImage(documentType);
  const ready = !!files.idFront && !!files.selfie && (!backNeeded || !!files.idBack);

  async function submit() {
    if (!ready || submitting) return;
    setSubmitting(true);
    try {
      const saved = await submitIdentityVerification({
        documentType,
        idFrontUri: files.idFront!,
        idBackUri: backNeeded ? files.idBack : null,
        selfieUri: files.selfie!,
      });
      setVerification(saved);
      setFiles(NO_FILES);
      await showSuccess(
        "Submitted for review",
        "A person on the Bovogo team checks every ID. This screen updates once they have.",
      );
    } catch (e) {
      // 409: something is already pending or approved, so show the real state.
      if (e instanceof ApiError && e.status === 409) void load();
      Alert.alert("Couldn't submit", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const status = verification?.status ?? null;
  const verified = status === "approved" || (status === null && !!user?.isVerified);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Identity verification</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : loadError ? (
          <>
            <StatusCard tone="wait" icon="alert-circle" title="Couldn't load this" sub={loadError} />
            <TouchableOpacity onPress={() => void load()} style={styles.retry}>
              <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
            </TouchableOpacity>
          </>
        ) : verified ? (
          <StatusCard
            tone="good"
            icon="check-circle"
            title="You're verified"
            sub="The Bovogo team has checked your ID. Your profile shows a Verified badge."
          />
        ) : status === "pending_review" ? (
          <StatusCard
            tone="wait"
            icon="clock"
            title="Under review"
            sub={`Submitted ${formatDay(verification!.submittedAt)}. A person on the Bovogo team checks every ID, and this screen updates once they have.`}
          />
        ) : (
          <>
            {status === "rejected" ? (
              <StatusCard
                tone="bad"
                icon="alert-circle"
                title="Needs attention"
                sub={
                  verification?.reviewNote ||
                  "We couldn't verify that submission. Please try again with clearer photos."
                }
              />
            ) : (
              <Text style={[styles.intro, { color: colors.mutedForeground }]}>
                Add a photo of a government ID and a selfie. A person on the Bovogo team compares
                them, and a Verified badge appears on your profile once they match.
              </Text>
            )}

            <View style={[styles.card, CARD_SHADOW, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Document</Text>
              <View style={styles.chipRow}>
                {ID_DOCUMENT_TYPES.map(({ type, label }) => {
                  const on = documentType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: on ? colors.primary : colors.muted,
                          borderColor: on ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setDocumentType(type)}
                      disabled={submitting}
                    >
                      <Text style={[styles.chipText, { color: on ? "#fff" : colors.foreground }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {SLOTS.filter((s) => s.slot !== "idBack" || backNeeded).map(({ slot, label, hint, icon }) => {
                const uri = files[slot];
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.slotRow, { borderColor: uri ? colors.primary : colors.border }]}
                    onPress={() => pick(slot)}
                    disabled={submitting}
                    activeOpacity={0.85}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={styles.thumb} />
                    ) : (
                      <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.secondary }]}>
                        <Feather name={icon} size={20} color={colors.primary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.slotLabel, { color: colors.foreground }]}>{label}</Text>
                      <Text style={[styles.slotHint, { color: colors.mutedForeground }]}>
                        {uri ? "Tap to retake" : hint}
                      </Text>
                    </View>
                    <Feather
                      name={uri ? "check-circle" : "camera"}
                      size={18}
                      color={uri ? colors.success : colors.mutedForeground}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
              <Feather name="lock" size={15} color={colors.primary} />
              <Text style={[styles.noticeText, { color: colors.primary }]}>
                Your ID and selfie are stored privately. Only the Bovogo review team can see them,
                never other members.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: ready ? colors.primary : colors.muted, opacity: submitting ? 0.7 : 1 },
              ]}
              onPress={submit}
              disabled={!ready || submitting}
              activeOpacity={0.88}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.submitText, { color: ready ? "#fff" : colors.mutedForeground }]}>
                  {status === "rejected" ? "Resubmit for review" : "Submit for review"}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
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
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 20, gap: 14, paddingBottom: 48 },

  intro: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 18, padding: 18 },
  statusTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusSub: { fontSize: 12.5, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 18 },
  retry: { alignSelf: "center", paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  card: { borderRadius: 20, padding: 18, gap: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  slotLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  slotHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  notice: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 14, borderRadius: 14 },
  noticeText: { flex: 1, fontSize: 12.5, fontFamily: "Inter_500Medium", lineHeight: 18 },

  submitBtn: { height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", marginTop: 4 },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
