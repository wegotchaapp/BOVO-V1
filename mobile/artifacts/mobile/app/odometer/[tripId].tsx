import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { CARD_SHADOW } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { Alert, showSuccess } from "@/lib/alert";
import {
  getManifest,
  nextKindFor,
  recordOdometerReading,
  type Manifest,
  type ManifestEntry,
  type ReadingKind,
} from "@/lib/odometer";

/**
 * Photograph the odometer, type the reading, and attach it to a Sailor.
 * Used at both pickup and dropoff; the difference between the two readings is
 * exactly how far that Sailor was carried.
 */
export default function OdometerCapture() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    tripId: string;
    bookingId?: string;
    kind?: ReadingKind;
  }>();
  const tripId = params.tripId;

  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [miles, setMiles] = useState("");
  const [bookingId, setBookingId] = useState<string | undefined>(params.bookingId);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getManifest(tripId)
      .then((m) => {
        if (cancelled) return;
        setManifest(m);
        // Default to the first Sailor still needing an action.
        if (!bookingId) {
          const next = m.entries.find((e) => nextKindFor(e) !== null);
          if (next) setBookingId(next.bookingId);
        }
      })
      .catch((e: any) => {
        if (!cancelled) Alert.alert("Couldn't load manifest", e?.message ?? "Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const selected: ManifestEntry | undefined = useMemo(
    () => manifest?.entries.find((e) => e.bookingId === bookingId),
    [manifest, bookingId],
  );

  // The action follows the Sailor's own state, so picking a different Sailor
  // switches pickup/dropoff automatically.
  const kind: ReadingKind | null = selected ? nextKindFor(selected) : null;

  const floor = useMemo(() => {
    const readings = [manifest?.lastOdometerMiles, selected?.pickupMiles].filter(
      (n): n is number => typeof n === "number",
    );
    return readings.length ? Math.max(...readings) : null;
  }, [manifest, selected]);

  async function capturePhoto() {
    try {
      if (Platform.OS === "web") {
        // expo-image-picker has no camera launcher on web; the file input still
        // offers the camera on mobile browsers.
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.6,
        });
        if (!result.canceled) setPhotoUri(result.assets[0].uri);
        return;
      }

      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Camera access needed",
          "A photo of the odometer is required as proof of the reading. Please enable camera access in Settings.",
        );
        return;
      }
      // Camera only — never the gallery, so the photo can't be an old one.
      const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      if (!result.canceled) setPhotoUri(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert("Couldn't open the camera", e?.message ?? "Please try again.");
    }
  }

  async function submit() {
    if (submitting) return;
    if (!selected || !kind) {
      Alert.alert("Choose a Sailor", "Select which Sailor this reading is for.");
      return;
    }
    if (!photoUri) {
      Alert.alert("Photo required", "Take a photo of the odometer before saving.");
      return;
    }
    const value = Number(miles.trim());
    if (!Number.isInteger(value) || value < 0) {
      Alert.alert("Check the reading", "Enter the odometer reading as a whole number of miles.");
      return;
    }
    if (floor != null && value < floor) {
      Alert.alert(
        "Reading looks too low",
        `An earlier reading on this adventure was ${floor.toLocaleString()} mi. An odometer only counts up.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      // Best-effort GPS stamp; never block the reading on a fix.
      let coords: { latitude: number; longitude: number } | undefined;
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        }
      } catch {
        // no fix — carry on
      }

      const res = await recordOdometerReading({
        tripId,
        bookingId: selected.bookingId,
        kind,
        miles: value,
        photoUri,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });

      const summary =
        kind === "dropoff" && res.milesTravelled != null
          ? `${selected.sailorName} travelled ${res.milesTravelled} miles.`
          : `${selected.sailorName} is now on board.`;

      await showSuccess(
        res.tripCompleted ? "Adventure complete" : "Reading saved",
        res.tripCompleted
          ? `${summary} Everyone has been dropped off, so this adventure is now complete and your savings record has been updated.`
          : summary,
        () => router.back(),
      );
    } catch (e: any) {
      Alert.alert("Couldn't save the reading", e?.message ?? "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const actionable = manifest?.entries.filter((e) => nextKindFor(e) !== null) ?? [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {kind === "dropoff" ? "Dropoff Odometer" : "Pickup Odometer"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              {/* 1 — Photo */}
              <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>
                1 · PHOTOGRAPH THE ODOMETER
              </Text>
              <TouchableOpacity
                style={[
                  styles.photoBox,
                  CARD_SHADOW,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={capturePhoto}
                activeOpacity={0.85}
              >
                {photoUri ? (
                  <>
                    <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
                    <View style={styles.retakePill}>
                      <Feather name="refresh-cw" size={12} color="#fff" />
                      <Text style={styles.retakeText}>Retake</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.photoEmpty}>
                    <Feather name="camera" size={32} color={colors.primary} />
                    <Text style={[styles.photoEmptyText, { color: colors.primary }]}>
                      Tap to photograph the odometer
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* 2 — Reading */}
              <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>
                2 · TYPE THE READING
              </Text>
              <View style={[styles.inputRow, CARD_SHADOW, { backgroundColor: colors.card }]}>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={miles}
                  onChangeText={(t) => setMiles(t.replace(/[^0-9]/g, ""))}
                  placeholder={floor != null ? String(floor) : "e.g. 84213"}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={7}
                />
                <Text style={[styles.inputUnit, { color: colors.mutedForeground }]}>miles</Text>
              </View>
              {floor != null ? (
                <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                  Must be at least {floor.toLocaleString()} mi — the last reading on this adventure.
                </Text>
              ) : null}

              {/* 3 — Sailor */}
              <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>
                3 · WHICH SAILOR?
              </Text>
              {actionable.length === 0 ? (
                <View style={[styles.card, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                    Every Sailor on this adventure has already been dropped off.
                  </Text>
                </View>
              ) : (
                actionable.map((entry) => {
                  const active = entry.bookingId === bookingId;
                  const entryKind = nextKindFor(entry);
                  return (
                    <TouchableOpacity
                      key={entry.bookingId}
                      style={[
                        styles.sailorOption,
                        {
                          backgroundColor: active ? colors.secondary : colors.card,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setBookingId(entry.bookingId)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.radio,
                          { borderColor: active ? colors.primary : colors.border },
                        ]}
                      >
                        {active ? (
                          <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sailorName, { color: colors.foreground }]}>
                          {entry.sailorName}
                        </Text>
                        <Text style={[styles.sailorMeta, { color: colors.mutedForeground }]}>
                          {entryKind === "pickup"
                            ? "Awaiting pickup"
                            : `On board since ${entry.pickupMiles?.toLocaleString()} mi`}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.kindChip,
                          { backgroundColor: entryKind === "pickup" ? "#FEF3E2" : colors.secondary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.kindChipText,
                            { color: entryKind === "pickup" ? "#B45309" : colors.primary },
                          ]}
                        >
                          {entryKind === "pickup" ? "Pickup" : "Dropoff"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: submitting || !kind || actionable.length === 0 ? 0.6 : 1,
                  },
                ]}
                onPress={submit}
                disabled={submitting || !kind || actionable.length === 0}
                activeOpacity={0.88}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="check" size={18} color="#fff" />
                    <Text style={styles.submitText}>
                      Save {kind === "dropoff" ? "dropoff" : "pickup"} reading
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
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
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 10 },
  loading: { paddingTop: 60, alignItems: "center" },

  stepLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginTop: 14,
  },

  photoBox: {
    height: 200,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  photo: { width: "100%", height: "100%" },
  photoEmpty: { alignItems: "center", gap: 10 },
  photoEmptyText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  retakePill: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  retakeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 18,
    height: 62,
    gap: 10,
  },
  input: { flex: 1, fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  inputUnit: { fontSize: 14, fontFamily: "Inter_500Medium" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  card: { padding: 16, borderRadius: 14 },

  sailorOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  sailorName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sailorMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  kindChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  kindChipText: { fontSize: 10.5, fontFamily: "Inter_600SemiBold" },

  submitBtn: {
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 22,
  },
  submitText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
