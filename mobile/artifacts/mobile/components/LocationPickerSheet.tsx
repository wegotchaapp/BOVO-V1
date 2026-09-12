import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Alert } from "@/lib/alert";

import { ALL_CITY_OPTIONS, type CityOption } from "@/data/cities";
import { filterNeighborhoods, getNeighborhoods } from "@/data/locations";
import { useColors } from "@/hooks/useColors";
import {
  isPlaceSearchConfigured,
  mergePlaceResults,
  newSearchSessionToken,
  retrieveMapboxPlace,
  searchLocalPlaces,
  searchMapboxPlaces,
  type PlaceResult,
} from "@/lib/places";

const SEARCH_DEBOUNCE_MS = 250;
const COMING_SOON_MESSAGE =
  "We're starting with the Austin ↔ Houston corridor. We'll let you know when this city goes live.";

function cityShort(label: string): string {
  return label.replace(/, [A-Z]{2}$/, "");
}

interface Props {
  visible: boolean;
  target: "from" | "to";
  /** What this end is set to now, so the list can tick it. */
  currentCity: string;
  currentArea: string;
  onClose: () => void;
  onSelect: (city: string, area: string) => void;
}

/**
 * The From / To picker. Typing suggests Bovogo's own areas and — when a Mapbox
 * token is configured — addresses and places, in one list. With nothing typed
 * it lists the cities, then a city's areas.
 */
export function LocationPickerSheet({
  visible,
  target,
  currentCity,
  currentArea,
  onClose,
  onSelect,
}: Props) {
  const colors = useColors();
  const [step, setStep] = useState<"search" | "area">("search");
  const [areaCity, setAreaCity] = useState("");
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  /** The result whose `/retrieve` is in flight, so its row can say so. */
  const [resolving, setResolving] = useState<string | null>(null);
  const sessionRef = useRef(newSearchSessionToken());
  const retrieveRef = useRef<AbortController | null>(null);

  // Each opening starts clean and is its own Mapbox billing session.
  useEffect(() => {
    if (!visible) {
      // Closing mid-lookup must not later select a place behind the rider's back.
      retrieveRef.current?.abort();
      retrieveRef.current = null;
      setResolving(null);
      return;
    }
    setStep("search");
    setAreaCity("");
    setQuery("");
    setRemote([]);
    setSearchFailed(false);
    sessionRef.current = newSearchSessionToken();
  }, [visible]);

  const trimmed = query.trim();
  const local = useMemo(
    () => (step === "search" ? searchLocalPlaces(trimmed) : []),
    [step, trimmed],
  );

  useEffect(() => {
    if (!visible || step !== "search" || trimmed.length < 2 || !isPlaceSearchConfigured()) {
      setRemote([]);
      setSearching(false);
      setSearchFailed(false);
      return;
    }
    const controller = new AbortController();
    // Addresses found for the last query must not stay tappable under the new
    // one: a slow reply would otherwise restore results for text long gone.
    setRemote([]);
    setSearchFailed(false);
    setSearching(true);
    const timer = setTimeout(() => {
      searchMapboxPlaces(trimmed, sessionRef.current, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) return;
          setRemote(results);
          setSearchFailed(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          // Bovogo's own areas still show; only the address search is missing.
          setRemote([]);
          setSearchFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [visible, step, trimmed]);

  const results = useMemo(() => mergePlaceResults(local, remote), [local, remote]);

  function apply(result: PlaceResult) {
    const t = result.target;
    if (t.kind === "coming-soon") {
      Alert.alert(`${t.city} — Coming Soon`, COMING_SOON_MESSAGE);
      return;
    }
    if (t.kind === "unsupported") {
      Alert.alert(
        "Not on Bovogo yet",
        `${result.title} is outside the Austin ↔ Houston corridor, which is where Bovogo runs for now.`,
      );
      return;
    }
    onSelect(t.city, t.area);
    onClose();
  }

  async function choose(result: PlaceResult) {
    // Bovogo's own rows are already resolved and need no network call.
    if (result.source !== "mapbox") {
      apply(result);
      return;
    }
    if (resolving) return;
    // Mapbox closes a Search Box session with a retrieve on the chosen
    // suggestion, and that response carries the place's definitive context.
    const controller = new AbortController();
    retrieveRef.current?.abort();
    retrieveRef.current = controller;
    setResolving(result.id);
    let resolved = result;
    try {
      resolved = (await retrieveMapboxPlace(result.id, sessionRef.current, controller.signal)) ?? result;
    } catch {
      // The suggestion already says which city it lands in; use that.
      resolved = result;
    } finally {
      if (retrieveRef.current === controller) retrieveRef.current = null;
      if (!controller.signal.aborted) setResolving(null);
    }
    if (controller.signal.aborted) return;
    apply(resolved);
  }

  function chooseCity(city: CityOption) {
    if (city.status === "coming-soon") {
      Alert.alert(`${city.label} — Coming Soon`, COMING_SOON_MESSAGE);
      return;
    }
    // Cities with mapped areas get a second step; the rest are chosen outright.
    if (getNeighborhoods(city.label).length > 0) {
      setAreaCity(city.label);
      setQuery("");
      setStep("area");
      return;
    }
    onSelect(city.label, "");
    onClose();
  }

  function chooseArea(area: string) {
    onSelect(areaCity, area);
    onClose();
  }

  function renderCities() {
    return ALL_CITY_OPTIONS.map((city) => {
      const comingSoon = city.status === "coming-soon";
      const areaCount = getNeighborhoods(city.label).length;
      return (
        <TouchableOpacity
          key={city.label}
          style={[styles.option, { borderBottomColor: colors.border, opacity: comingSoon ? 0.6 : 1 }]}
          onPress={() => chooseCity(city)}
          activeOpacity={0.7}
        >
          <View style={[styles.optionIcon, { backgroundColor: comingSoon ? colors.muted : colors.secondary }]}>
            <Feather name="map-pin" size={14} color={comingSoon ? colors.mutedForeground : colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionText, { color: colors.foreground }]}>{city.label}</Text>
            {!comingSoon && areaCount > 0 ? (
              <Text style={[styles.optionMeta, { color: colors.mutedForeground }]}>{areaCount} areas</Text>
            ) : null}
          </View>
          {comingSoon ? (
            <View style={[styles.badge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>Coming soon</Text>
            </View>
          ) : (
            <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
          )}
        </TouchableOpacity>
      );
    });
  }

  function renderResults() {
    if (results.length === 0) {
      return (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {searching
              ? "Searching…"
              : searchFailed
                ? `No Bovogo areas match "${trimmed}", and address search isn't reachable right now.`
                : `No places match "${trimmed}"`}
          </Text>
        </View>
      );
    }
    return (
      <>
        {results.map((r) => {
          const t = r.target;
          const unavailable = t.kind !== "ok";
          const selected = t.kind === "ok" && t.city === currentCity && t.area === currentArea;
          const busy = resolving === r.id;
          const icon =
            r.source === "mapbox" ? "navigation" : t.kind === "ok" && !t.area ? "globe" : "map-pin";
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.option, { borderBottomColor: colors.border, opacity: unavailable ? 0.6 : 1 }]}
              onPress={() => void choose(r)}
              disabled={!!resolving && !busy}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIcon, { backgroundColor: unavailable ? colors.muted : colors.secondary }]}>
                <Feather name={icon} size={14} color={unavailable ? colors.mutedForeground : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionText, { color: colors.foreground }]} numberOfLines={1}>
                  {r.title}
                </Text>
                {r.subtitle ? (
                  <Text style={[styles.optionMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {r.subtitle}
                  </Text>
                ) : null}
              </View>
              {busy ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : t.kind === "coming-soon" ? (
                <View style={[styles.badge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>Coming soon</Text>
                </View>
              ) : t.kind === "unsupported" ? (
                <View style={[styles.badge, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>Not yet</Text>
                </View>
              ) : selected ? (
                <Feather name="check" size={16} color={colors.primary} />
              ) : null}
            </TouchableOpacity>
          );
        })}
        {searchFailed ? (
          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
            Address search isn't reachable right now — showing Bovogo areas only.
          </Text>
        ) : remote.length > 0 ? (
          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>Places by Mapbox</Text>
        ) : null}
      </>
    );
  }

  function renderAreas() {
    const areas = filterNeighborhoods(getNeighborhoods(areaCity), query);
    const selectedArea = currentCity === areaCity ? currentArea : null;
    return (
      <>
        {/* "Any area" keeps the search broad — it is the default. */}
        <TouchableOpacity
          style={[styles.option, { borderBottomColor: colors.border }]}
          onPress={() => chooseArea("")}
          activeOpacity={0.7}
        >
          <View style={[styles.optionIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="globe" size={14} color={colors.primary} />
          </View>
          <Text style={[styles.optionText, { color: colors.foreground, flex: 1 }]}>
            Any area in {cityShort(areaCity)}
          </Text>
          {selectedArea === "" ? <Feather name="check" size={16} color={colors.primary} /> : null}
        </TouchableOpacity>

        {areas.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No areas match "{query}"
            </Text>
          </View>
        ) : (
          areas.map((area) => (
            <TouchableOpacity
              key={area}
              style={[styles.option, { borderBottomColor: colors.border }]}
              onPress={() => chooseArea(area)}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="map-pin" size={14} color={colors.primary} />
              </View>
              <Text style={[styles.optionText, { color: colors.foreground, flex: 1 }]}>{area}</Text>
              {selectedArea === area ? (
                <Feather name="check" size={16} color={colors.primary} />
              ) : (
                <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
              )}
            </TouchableOpacity>
          ))
        )}
      </>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* A fixed, tall sheet keeps the search field above the keyboard, which
            would otherwise cover a short bottom sheet entirely. */}
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            {step === "area" ? (
              <TouchableOpacity
                onPress={() => {
                  setStep("search");
                  setQuery("");
                }}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel="Back to search"
              >
                <Feather name="chevron-left" size={20} color={colors.foreground} />
              </TouchableOpacity>
            ) : null}
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {step === "search"
                ? `Select ${target === "from" ? "Origin" : "Destination"}`
                : `Area in ${cityShort(areaCity)}`}
            </Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchBox, { backgroundColor: colors.muted }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder={step === "search" ? "Search a city, area or address" : "Search areas…"}
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searching ? <ActivityIndicator size="small" color={colors.mutedForeground} /> : null}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {step === "area" ? renderAreas() : trimmed ? renderResults() : renderCities()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12, height: "85%" },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E3DDD3", alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold" },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center", marginLeft: -6 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 12, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", paddingVertical: 0 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1 },
  optionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  optionText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  optionMeta: { fontSize: 11.5, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  empty: { paddingVertical: 32, alignItems: "center", paddingHorizontal: 12 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  footnote: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 12 },
});
