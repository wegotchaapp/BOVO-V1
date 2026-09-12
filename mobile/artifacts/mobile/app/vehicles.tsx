import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Alert } from "@/lib/alert";

import { CARD_SHADOW, INK_ON_MUTED } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import {
  describeVehicle,
  getBackgroundCheck,
  listMyVehicles,
  MAX_VEHICLES,
  startBackgroundCheck,
  vehicleStatusLabel,
  type BackgroundCheck,
  type Vehicle,
} from "@/lib/vehicles";

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

// Module scope keeps the component identity stable across renders.
function VehicleCard({ vehicle, onPress }: { vehicle: Vehicle; onPress?: () => void }) {
  const colors = useColors();
  const status = vehicle.verificationStatus;
  const pill =
    status === "approved"
      ? { bg: "#ECFDF5", ink: "#059669" }
      : status === "rejected"
        ? { bg: "#FEF2F2", ink: "#DC2626" }
        : vehicle.missingRequirements.length === 0
          ? { bg: "#FEF3E2", ink: "#B45309" }
          : { bg: colors.muted, ink: INK_ON_MUTED };

  const body = (
    <>
      <View style={[styles.vehicleIcon, { backgroundColor: colors.secondary }]}>
        <Feather name="truck" size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.vehicleTitle, { color: colors.foreground }]} numberOfLines={1}>
          {describeVehicle(vehicle) || "Vehicle"} · {vehicle.year}
        </Text>
        <Text style={[styles.vehicleSub, { color: colors.mutedForeground }]}>
          {vehicle.licensePlate} · {vehicle.state}
        </Text>
        <View style={[styles.pill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.pillText, { color: pill.ink }]}>{vehicleStatusLabel(vehicle)}</Text>
        </View>
        {status === "rejected" && vehicle.verificationNote ? (
          <Text style={[styles.vehicleNote, { color: "#7F1D1D" }]}>{vehicle.verificationNote}</Text>
        ) : null}
      </View>
      {/* Approved vehicles are shown, not edited, so they get no affordance. */}
      {onPress ? <Feather name="chevron-right" size={18} color={colors.mutedForeground} /> : null}
    </>
  );

  return onPress ? (
    <TouchableOpacity style={[styles.vehicleCard, CARD_SHADOW, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.85}>
      {body}
    </TouchableOpacity>
  ) : (
    <View style={[styles.vehicleCard, CARD_SHADOW, { backgroundColor: colors.card }]}>{body}</View>
  );
}

/**
 * Every vehicle the Voyager has registered, with its review state. Approved
 * vehicles can't be changed; "Add vehicle" starts verification for another car.
 */
export default function VehiclesScreen() {
  const colors = useColors();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [check, setCheck] = useState<BackgroundCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    const [vRes, cRes] = await Promise.allSettled([listMyVehicles(), getBackgroundCheck()]);
    if (vRes.status === "fulfilled") {
      setVehicles(vRes.value);
      setError(null);
    } else {
      setError(vRes.reason instanceof Error ? vRes.reason.message : "Couldn't load your vehicles.");
    }
    if (cRes.status === "fulfilled") setCheck(cRes.value);
  }, []);

  // Reloads on focus, so a vehicle saved on the next screen is here on return.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function addVehicle() {
    if ((vehicles?.length ?? 0) >= MAX_VEHICLES) {
      Alert.alert("Vehicle limit reached", `You can register up to ${MAX_VEHICLES} vehicles.`);
      return;
    }
    router.push("/vehicle");
  }

  /** The provider is not switched on, so there is nothing to start. */
  const checkUnavailable = !!check && !check.configured;

  async function handleBackgroundCheck() {
    setStarting(true);
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
      setStarting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Vehicles</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {vehicles === null && !error ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : null}

        {error ? (
          <View style={[styles.stateCard, CARD_SHADOW, { backgroundColor: colors.card }]}>
            <Feather name="alert-triangle" size={20} color={colors.destructive} />
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{error}</Text>
            <TouchableOpacity onPress={() => void load()}>
              <Text style={[styles.link, { color: colors.primary }]}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {vehicles && vehicles.length === 0 ? (
          <View style={[styles.stateCard, CARD_SHADOW, { backgroundColor: colors.card }]}>
            <Feather name="truck" size={22} color={colors.primary} />
            <Text style={[styles.stateTitle, { color: colors.foreground }]}>No vehicles yet</Text>
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
              Add the car you'll drive. We check every vehicle before it carries Sailors.
            </Text>
          </View>
        ) : null}

        {vehicles?.map((v) => (
          <VehicleCard
            key={v.id}
            vehicle={v}
            onPress={
              v.verificationStatus === "approved"
                ? undefined
                : () => router.push({ pathname: "/vehicle", params: { id: v.id } })
            }
          />
        ))}

        {vehicles ? (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={addVehicle}
            activeOpacity={0.88}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add vehicle</Text>
          </TouchableOpacity>
        ) : null}

        {/* ── Background check — one per Voyager, not per vehicle ──────────── */}
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

          {/* `configured: false` means the provider is not switched on, so there
              is no button to offer — starting it would only fail. */}
          {check && !checkUnavailable && check.status !== "clear" ? (
            <TouchableOpacity
              style={[styles.checkBtn, { backgroundColor: colors.primary }]}
              onPress={handleBackgroundCheck}
              disabled={starting}
              activeOpacity={0.88}
            >
              {starting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="external-link" size={16} color="#fff" />
                  <Text style={styles.checkBtnText}>
                    {check.status === "not_started" ? "Start background check" : "Continue on Checkr"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
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
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  scroll: { paddingHorizontal: 20, paddingBottom: 48, gap: 14 },

  vehicleCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 18, padding: 16 },
  vehicleIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  vehicleTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  vehicleSub: { fontSize: 12.5, fontFamily: "Inter_400Regular" },
  vehicleNote: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 2 },
  pill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 3 },
  pillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  stateCard: { borderRadius: 18, padding: 20, alignItems: "center", gap: 8 },
  stateTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  stateText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  link: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 4 },

  addBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  card: { borderRadius: 20, padding: 20, gap: 16, marginTop: 6 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionSub: { fontSize: 12.5, fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: -8 },
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
});
