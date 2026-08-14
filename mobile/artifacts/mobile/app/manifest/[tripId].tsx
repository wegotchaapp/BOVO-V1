import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { CARD_SHADOW } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";
import { Alert } from "@/lib/alert";
import {
  getManifest,
  nextKindFor,
  type Manifest,
  type ManifestEntry,
} from "@/lib/odometer";

/**
 * The Voyager's working view during an adventure: everyone on board, and the
 * one action each Sailor needs next. Odometer readings are captured from here.
 */
export default function AdventureManifest() {
  const colors = useColors();
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    setError(null);
    try {
      setManifest(await getManifest(tripId));
    } catch (e: any) {
      setError(e?.message ?? "Couldn't load your manifest.");
    }
  }, [tripId]);

  // Re-fetch on focus so returning from the odometer screen shows fresh state.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load().finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function openCapture(entry: ManifestEntry) {
    const kind = nextKindFor(entry);
    if (!kind) return;
    router.push({
      pathname: "/odometer/[tripId]",
      params: { tripId: tripId!, bookingId: entry.bookingId, kind },
    });
  }

  const entries = manifest?.entries ?? [];
  const remaining = entries.filter((e) => e.status !== "dropped_off").length;
  const complete = manifest?.tripStatus === "completed";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Adventure Manifest</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {loading && !manifest ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={[styles.card, CARD_SHADOW, { backgroundColor: colors.card }]}>
            <Feather name="alert-circle" size={20} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.foreground }]}>{error}</Text>
            <TouchableOpacity
              onPress={() => load()}
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.statusCard,
                CARD_SHADOW,
                { backgroundColor: complete ? "#ECFDF5" : colors.card },
              ]}
            >
              <Feather
                name={complete ? "check-circle" : "navigation"}
                size={22}
                color={complete ? "#059669" : colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: colors.foreground }]}>
                  {complete
                    ? "Adventure complete"
                    : remaining === 0
                      ? "Everyone dropped off"
                      : `${remaining} Sailor${remaining === 1 ? "" : "s"} still to drop off`}
                </Text>
                <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                  {manifest?.lastOdometerMiles != null
                    ? `Last odometer reading: ${manifest.lastOdometerMiles.toLocaleString()} mi`
                    : "No odometer readings logged yet"}
                </Text>
              </View>
            </View>

            {!manifest?.startVideoRecorded ? (
              <TouchableOpacity
                style={[styles.warnCard, { backgroundColor: "#FEF3E2" }]}
                onPress={() =>
                  router.push({ pathname: "/pre-trip-video", params: { tripId: tripId! } })
                }
                activeOpacity={0.85}
              >
                <Feather name="video" size={16} color="#B45309" />
                <Text style={[styles.warnText, { color: "#7A5A1E" }]}>
                  Record your 360° car video before logging odometer readings.
                </Text>
                <Feather name="chevron-right" size={16} color="#B45309" />
              </TouchableOpacity>
            ) : null}

            {entries.length === 0 ? (
              <View style={[styles.card, CARD_SHADOW, { backgroundColor: colors.card }]}>
                <Feather name="users" size={20} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No Sailors have booked this adventure yet.
                </Text>
              </View>
            ) : (
              entries.map((entry) => (
                <SailorRow
                  key={entry.bookingId}
                  entry={entry}
                  colors={colors}
                  disabled={!manifest?.startVideoRecorded}
                  onPress={() => {
                    if (!manifest?.startVideoRecorded) {
                      Alert.alert(
                        "Car video required",
                        "Record the 360° video of your car before logging odometer readings.",
                      );
                      return;
                    }
                    openCapture(entry);
                  }}
                />
              ))
            )}

            <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
              <Feather name="info" size={14} color={colors.primary} />
              <Text style={[styles.noticeText, { color: colors.primary }]}>
                Photographing the odometer at each pickup and dropoff records exactly how far
                each Sailor travelled. It's what backs your savings record and your
                cost-sharing documentation.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SailorRow({
  entry,
  colors,
  disabled,
  onPress,
}: {
  entry: ManifestEntry;
  colors: ReturnType<typeof useColors>;
  disabled: boolean;
  onPress: () => void;
}) {
  const kind = nextKindFor(entry);
  const done = kind === null;

  const chip = done
    ? { label: "Dropped off", color: "#059669", bg: "#ECFDF5" }
    : entry.status === "on_board"
      ? { label: "On board", color: colors.primary, bg: colors.secondary }
      : { label: "Awaiting pickup", color: "#B45309", bg: "#FEF3E2" };

  const initials = entry.sailorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={[styles.sailorCard, CARD_SHADOW, { backgroundColor: colors.card }]}>
      <View style={styles.sailorTop}>
        {entry.sailorPhotoUrl ? (
          <Image source={{ uri: entry.sailorPhotoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.sailorName, { color: colors.foreground }]}>{entry.sailorName}</Text>
          <Text style={[styles.sailorMeta, { color: colors.mutedForeground }]}>
            {entry.seats} seat{entry.seats === 1 ? "" : "s"}
            {entry.milesTravelled != null ? ` · ${entry.milesTravelled} mi travelled` : ""}
          </Text>
        </View>
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
        </View>
      </View>

      {entry.pickupMiles != null ? (
        <View style={[styles.readingRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.readingLabel, { color: colors.mutedForeground }]}>
            Pickup {entry.pickupMiles.toLocaleString()} mi
          </Text>
          {entry.dropoffMiles != null ? (
            <Text style={[styles.readingLabel, { color: colors.mutedForeground }]}>
              Dropoff {entry.dropoffMiles.toLocaleString()} mi
            </Text>
          ) : null}
        </View>
      ) : null}

      {!done ? (
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: disabled ? colors.muted : colors.primary },
          ]}
          onPress={onPress}
          activeOpacity={0.88}
        >
          <Feather name="camera" size={16} color={disabled ? colors.mutedForeground : "#fff"} />
          <Text
            style={[styles.actionText, { color: disabled ? colors.mutedForeground : "#fff" }]}
          >
            Record {kind === "pickup" ? "pickup" : "dropoff"} odometer
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
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
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  loading: { paddingTop: 60, alignItems: "center" },
  card: { borderRadius: 18, padding: 20, gap: 12, alignItems: "center" },
  errorText: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryBtn: { paddingHorizontal: 22, paddingVertical: 11, borderRadius: 22 },
  retryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  statusCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 18, padding: 18 },
  statusTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },

  warnCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14 },
  warnText: { flex: 1, fontSize: 12.5, fontFamily: "Inter_500Medium", lineHeight: 18 },

  sailorCard: { borderRadius: 18, padding: 16, gap: 12 },
  sailorTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sailorName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sailorMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipText: { fontSize: 10.5, fontFamily: "Inter_600SemiBold" },

  readingRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 10 },
  readingLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },

  actionBtn: {
    height: 46,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 14, borderRadius: 14 },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
