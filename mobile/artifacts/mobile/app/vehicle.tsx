import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Alert, showSuccess } from "@/lib/alert";

import { CARD_SHADOW, INK_ON_MUTED } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import {
  getBackgroundCheck,
  listMyVehicles,
  PHOTO_SLOTS,
  startBackgroundCheck,
  uploadVehicleDocument,
  uploadVehiclePhoto,
  upsertVehicle,
  type BackgroundCheck,
  type DocKind,
  type PhotoSlot,
  type Vehicle,
} from "@/lib/vehicles";

const MAKES = ["Toyota", "Honda", "Ford", "Chevrolet", "Tesla", "Hyundai", "Kia", "Nissan", "Jeep", "Subaru"];
const COLORS_LIST = ["White", "Black", "Silver", "Gray", "Red", "Blue", "Green", "Brown", "Orange", "Yellow"];
const YEARS = Array.from({ length: 15 }, (_, i) => String(2026 - i));
const STATES = ["TX", "OK", "LA", "NM", "AR"];
const SEAT_OPTIONS = ["1", "2", "3", "4", "5", "6", "7"];
const DOOR_OPTIONS = ["2", "3", "4", "5"];

/** 17 characters; I, O and Q are excluded from the VIN standard. */
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

const DOCS: { kind: DocKind; label: string; sub: string }[] = [
  { kind: "insurance", label: "Insurance certificate", sub: "Must be current and name you as a driver" },
  { kind: "registration", label: "Vehicle registration", sub: "Current state registration for this VIN" },
];

export default function VehicleScreen() {
  const colors = useColors();
  const router = useRouter();

  const [make, setMake] = useState("Toyota");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("2022");
  const [color, setColor] = useState("White");
  const [state, setState] = useState("TX");
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [seats, setSeats] = useState("3");
  const [doors, setDoors] = useState("4");

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [check, setCheck] = useState<BackgroundCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const hydrate = useCallback((v: Vehicle) => {
    setVehicle(v);
    setMake(v.make);
    setModel(v.model);
    setYear(String(v.year));
    setColor(v.color);
    setState(v.state || "TX");
    setPlate(v.licensePlate);
    setVin(v.vin ?? "");
    if (v.seatCount) setSeats(String(v.seatCount));
    if (v.doorCount) setDoors(String(v.doorCount));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([listMyVehicles(), getBackgroundCheck()])
      .then(([vRes, cRes]) => {
        if (cancelled) return;
        if (vRes.status === "fulfilled" && vRes.value[0]) hydrate(vRes.value[0]);
        if (cRes.status === "fulfilled") setCheck(cRes.value);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  async function handleSave() {
    Keyboard.dismiss();
    if (!model.trim()) return Alert.alert("Required", "Enter your vehicle model.");
    if (!plate.trim()) return Alert.alert("Required", "Enter your licence plate number.");

    const cleanVin = vin.trim().toUpperCase().replace(/[\s-]/g, "");
    if (!VIN_PATTERN.test(cleanVin)) {
      return Alert.alert(
        "Check your VIN",
        "A VIN is exactly 17 characters and never contains the letters I, O or Q. You'll find it on the dashboard by the windscreen, or on the driver's door frame.",
      );
    }

    setSaving(true);
    try {
      const saved = await upsertVehicle({
        make,
        model: model.trim(),
        year: Number(year),
        color,
        licensePlate: plate.trim(),
        state,
        vin: cleanVin,
        seatCount: Number(seats),
        doorCount: Number(doors),
      });
      hydrate(saved);
      if (saved.isComplete) {
        await showSuccess(
          "Vehicle submitted",
          "We check every vehicle before it carries Sailors. You can post once it's approved.",
        );
      }
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  /** Photos must come from the camera so they document the actual vehicle. */
  async function capturePhoto(slot: PhotoSlot) {
    if (!vehicle) {
      return Alert.alert(
        "Save your details first",
        "Enter your vehicle details and tap Save, then add the photos.",
      );
    }
    setBusySlot(slot);
    try {
      let uri: string | null = null;
      if (Platform.OS === "web") {
        // No camera launcher on web; the file input still offers the camera on
        // mobile browsers.
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.7,
        });
        if (!res.canceled) uri = res.assets[0].uri;
      } else {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            "Camera access needed",
            "Vehicle photos must be taken with the camera so they show your actual car.",
          );
          return;
        }
        const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (!res.canceled) uri = res.assets[0].uri;
      }
      if (!uri) return;
      setVehicle(await uploadVehiclePhoto(slot, uri));
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message ?? "Please try again.");
    } finally {
      setBusySlot(null);
    }
  }

  /** Documents may be photographed or picked from the library. */
  async function uploadDoc(kind: DocKind) {
    if (!vehicle) {
      return Alert.alert(
        "Save your details first",
        "Enter your vehicle details and tap Save, then add your documents.",
      );
    }
    setBusySlot(kind);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (res.canceled) return;
      setVehicle(await uploadVehicleDocument(kind, res.assets[0].uri));
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message ?? "Please try again.");
    } finally {
      setBusySlot(null);
    }
  }

  /** The provider is not switched on, so there is nothing to start. */
  const checkUnavailable = !!check && !check.configured;

  async function handleBackgroundCheck() {
    setBusySlot("checkr");
    try {
      const res = await startBackgroundCheck();
      if (res.alreadyCleared) {
        Alert.alert("Already cleared", "Your background check is complete.");
        return;
      }
      if (res.invitationUrl) await Linking.openURL(res.invitationUrl);
      setCheck(await getBackgroundCheck());
    } catch (e: any) {
      Alert.alert("Couldn't start the check", e?.message ?? "Please try again.");
    } finally {
      setBusySlot(null);
    }
  }

  function pickerRow(
    label: string,
    value: string,
    options: string[],
    onSelect: (v: string) => void,
  ) {
    return (
      <View style={styles.fieldBlock}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.chip,
                {
                  backgroundColor: value === opt ? colors.primary : colors.muted,
                  borderColor: value === opt ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onSelect(opt)}
            >
              <Text style={[styles.chipText, { color: value === opt ? "#fff" : colors.foreground }]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  const missing = vehicle?.missingRequirements ?? [];
  const status = vehicle?.verificationStatus ?? "incomplete";
  // No vehicle yet is NOT the same as a vehicle with nothing outstanding —
  // both produce an empty `missing` list, so check for the record itself.
  const ready = !!vehicle && missing.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Vehicle</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveLink, { color: colors.primary, opacity: saving ? 0.5 : 1 }]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Readiness — one place that says what's outstanding */}
              <View
                style={[
                  styles.statusCard,
                  CARD_SHADOW,
                  { backgroundColor: ready ? "#ECFDF5" : colors.card },
                ]}
              >
                <Feather
                  name={
                    status === "approved" ? "check-circle" : ready ? "clock" : "alert-circle"
                  }
                  size={22}
                  color={ready ? "#059669" : "#D97706"}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusTitle, { color: colors.foreground }]}>
                    {!vehicle
                      ? "No vehicle added yet"
                      : status === "approved"
                        ? "Vehicle approved"
                        : status === "rejected"
                          ? "Needs attention"
                          : ready
                            ? "Submitted for review"
                            : `${missing.length} item${missing.length === 1 ? "" : "s"} still needed`}
                  </Text>
                  <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                    {!vehicle
                      ? "Fill in your details below and tap Save, then add photos and documents."
                      : status === "rejected" && vehicle.verificationNote
                        ? vehicle.verificationNote
                        : ready
                          ? "We check every vehicle before it carries Sailors. You can post once it's approved."
                          : "You can't post an adventure until everything below is complete."}
                  </Text>
                </View>
              </View>

              {missing.length > 0 ? (
                <View style={[styles.missingCard, { backgroundColor: "#FEF3E2" }]}>
                  {missing.map((m) => (
                    <View key={m} style={styles.missingRow}>
                      <Feather name="circle" size={10} color="#B45309" />
                      <Text style={[styles.missingText, { color: "#7A5A1E" }]}>{m}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* ── Details ───────────────────────────────────────────── */}
              <View style={[styles.card, CARD_SHADOW, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Details</Text>

                {pickerRow("Make", make, MAKES, setMake)}
                <View style={styles.fieldBlock}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Model *</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground }]}
                    value={model}
                    onChangeText={setModel}
                    placeholder="e.g. Camry, Civic, F-150"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                {pickerRow("Year", year, YEARS, setYear)}
                {pickerRow("Colour", color, COLORS_LIST, setColor)}
                {pickerRow("Seats for Sailors *", seats, SEAT_OPTIONS, setSeats)}
                {pickerRow("Doors *", doors, DOOR_OPTIONS, setDoors)}
                {pickerRow("State", state, STATES, setState)}

                <View style={styles.fieldBlock}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Licence plate *</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground }]}
                    value={plate}
                    onChangeText={(t) => setPlate(t.toUpperCase())}
                    placeholder="e.g. ABC-1234"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>VIN *</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      { backgroundColor: colors.muted, color: colors.foreground, letterSpacing: 1 },
                    ]}
                    value={vin}
                    onChangeText={(t) => setVin(t.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    placeholder="17 characters"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={17}
                  />
                  <Text style={[styles.helpText, { color: colors.mutedForeground }]}>
                    {vin.length}/17 · On the dashboard by the windscreen, or the driver's door
                    frame. Never contains I, O or Q.
                  </Text>
                </View>
              </View>

              {/* ── Photos ────────────────────────────────────────────── */}
              <View style={[styles.card, CARD_SHADOW, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Photos — all five required
                </Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  Four sides plus the interior, taken with your camera, so Sailors see the
                  car they'll actually be riding in.
                </Text>

                <View style={styles.photoGrid}>
                  {PHOTO_SLOTS.map(({ slot, label, hint }) => {
                    const uri = vehicle?.photos?.[slot] ?? null;
                    const busy = busySlot === slot;
                    return (
                      <TouchableOpacity
                        key={slot}
                        style={[styles.photoTile, { borderColor: uri ? colors.primary : colors.border }]}
                        onPress={() => capturePhoto(slot)}
                        disabled={busy}
                        activeOpacity={0.85}
                      >
                        {busy ? (
                          <ActivityIndicator color={colors.primary} />
                        ) : uri ? (
                          <>
                            <Image source={{ uri }} style={styles.photoImg} resizeMode="cover" />
                            <View style={styles.photoCheck}>
                              <Feather name="check" size={11} color="#fff" />
                            </View>
                          </>
                        ) : (
                          <>
                            <Feather name="camera" size={20} color={colors.primary} />
                            <Text style={[styles.photoLabel, { color: colors.foreground }]}>{label}</Text>
                            <Text style={[styles.photoHint, { color: colors.mutedForeground }]}>{hint}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Documents ─────────────────────────────────────────── */}
              <View style={[styles.card, CARD_SHADOW, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Documents — both required
                </Text>
                {DOCS.map((doc) => {
                  const uploaded = !!vehicle?.documents?.[doc.kind]?.url;
                  const busy = busySlot === doc.kind;
                  return (
                    <TouchableOpacity
                      key={doc.kind}
                      style={[styles.docRow, { borderBottomColor: colors.border }]}
                      onPress={() => uploadDoc(doc.kind)}
                      disabled={busy}
                      activeOpacity={0.75}
                    >
                      <View
                        style={[
                          styles.docIcon,
                          { backgroundColor: uploaded ? "#ECFDF5" : colors.secondary },
                        ]}
                      >
                        <Feather
                          name={uploaded ? "check" : "file-text"}
                          size={16}
                          color={uploaded ? "#059669" : colors.primary}
                        />
                      </View>
                      <View style={styles.docText}>
                        <Text style={[styles.docTitle, { color: colors.foreground }]}>{doc.label}</Text>
                        <Text style={[styles.docSub, { color: colors.mutedForeground }]}>
                          {uploaded ? "Uploaded" : doc.sub}
                        </Text>
                      </View>
                      {busy ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <Feather
                          name={uploaded ? "refresh-cw" : "upload"}
                          size={16}
                          color={colors.mutedForeground}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* ── Background check ──────────────────────────────────── */}
              <View style={[styles.card, CARD_SHADOW, { backgroundColor: colors.card }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Background check</Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
                  Required to carry Sailors. You'll enter your SSN on Checkr's own secure
                  page — it never passes through Bovogo, and we never store it.
                </Text>

                <View style={[styles.checkRow, { backgroundColor: colors.muted }]}>
                  <Feather
                    name={check?.status === "clear" ? "shield" : "shield-off"}
                    size={18}
                    color={check?.status === "clear" ? colors.success : INK_ON_MUTED}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.checkTitle, { color: colors.foreground }]}>
                      {backgroundLabel(check)}
                    </Text>
                    {check?.ssnLast4 ? (
                      <Text style={[styles.checkSub, { color: INK_ON_MUTED }]}>
                        SSN held by Checkr: •••• {check.ssnLast4}
                      </Text>
                    ) : null}
                    {checkUnavailable ? (
                      <Text style={[styles.checkSub, { color: INK_ON_MUTED }]}>
                        There is nothing to do here yet. You'll be able to start it once
                        checks are switched on.
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* `configured: false` means the provider is not switched on. The
                    button used to render anyway, so the screen said "Not available
                    yet" and then offered to start it — and starting it failed. */}
                {!checkUnavailable && check?.status !== "clear" ? (
                  <TouchableOpacity
                    style={[styles.checkBtn, { backgroundColor: colors.primary }]}
                    onPress={handleBackgroundCheck}
                    disabled={busySlot === "checkr"}
                    activeOpacity={0.88}
                  >
                    {busySlot === "checkr" ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Feather name="external-link" size={16} color="#fff" />
                        <Text style={styles.checkBtnText}>
                          {check?.status === "not_started"
                            ? "Start background check"
                            : "Continue on Checkr"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.88}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="save" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>Save vehicle</Text>
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

function backgroundLabel(c: BackgroundCheck | null): string {
  if (!c) return "Not started";
  if (!c.configured) return "Not available yet";
  switch (c.status) {
    case "clear":
      return "Cleared";
    case "consider":
      return "Under review by our team";
    case "suspended":
      return "Paused — Checkr needs more information";
    case "pending":
      return "In progress with Checkr";
    case "invitation_sent":
      return "Invitation sent — finish it on Checkr";
    default:
      return "Not started";
  }
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
  saveLink: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  scroll: { paddingHorizontal: 20, paddingBottom: 48, gap: 14 },

  statusCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 18, padding: 18 },
  statusTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 18 },

  missingCard: { borderRadius: 14, padding: 14, gap: 7 },
  missingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  missingText: { fontSize: 12.5, fontFamily: "Inter_500Medium", flex: 1 },

  card: { borderRadius: 20, padding: 20, gap: 16 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionSub: { fontSize: 12.5, fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: -8 },

  fieldBlock: { gap: 10 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3, textTransform: "uppercase" },
  chipScroll: { gap: 8, paddingRight: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  textInput: { height: 46, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  helpText: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },

  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoTile: {
    width: "47%",
    aspectRatio: 1.25,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 8,
    overflow: "hidden",
  },
  photoImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  photoCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  photoLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  photoHint: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 14 },

  docRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  docIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  docText: { flex: 1, gap: 3 },
  docTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  docSub: { fontSize: 12, fontFamily: "Inter_400Regular" },

  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14 },
  checkTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  checkSub: { fontSize: 11.5, fontFamily: "Inter_400Regular", marginTop: 2 },
  checkBtn: {
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  checkBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  saveBtn: {
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 6,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
