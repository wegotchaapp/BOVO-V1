import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { ALL_CITY_OPTIONS, MVP_CITIES, isMvpCity } from "@/data/cities";
import { filterNeighborhoods, getNeighborhoods } from "@/data/locations";
import { useColors } from "@/hooks/useColors";
import { calculateSuggestedPrice, getDistanceMiles } from "@/lib/pricing";
import { createTrip } from "@/lib/trips";

const MAX_MESSAGE = 500;
const MAX_SEATS = 6;
const MAX_LUGGAGE = 6;

// Field renderer — declared at module scope so its component identity is stable
// across renders. (Declaring this inside the screen component caused the
// TextInput inside to unmount/remount on every keystroke, losing focus.)
function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      {children}
      {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(hour: number, minute: number): string {
  const ampm = hour < 12 ? "AM" : "PM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayMin = minute.toString().padStart(2, "0");
  return `${displayHour}:${displayMin} ${ampm}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ─── Wheel picker ──────────────────────────────────────────────────────────────

const WHEEL_ITEM_H = 52;
const WHEEL_VISIBLE = 5;
const WHEEL_H = WHEEL_ITEM_H * WHEEL_VISIBLE;

const WHEEL_HOURS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const WHEEL_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const WHEEL_PERIODS = ["AM", "PM"];

function WheelColumn({
  items,
  index,
  onIndexChange,
}: {
  items: string[];
  index: number;
  onIndexChange: (i: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: index * WHEEL_ITEM_H, animated: false });
  }, []);

  function commit(y: number) {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(y / WHEEL_ITEM_H)));
    onIndexChange(i);
  }

  return (
    <View style={wStyles.column}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_H}
        decelerationRate="fast"
        bounces={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => commit(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => commit(e.nativeEvent.contentOffset.y)}
        contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H * 2 }}
      >
        {items.map((item, i) => {
          const dist = Math.abs(i - index);
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.35 : 0.12;
          const scale = dist === 0 ? 1.1 : 1;
          const fontFamily = dist === 0 ? "Inter_700Bold" : "Inter_400Regular";
          const fontSize = dist === 0 ? 26 : 19;
          return (
            <TouchableOpacity
              key={i}
              style={wStyles.item}
              activeOpacity={1}
              onPress={() => {
                scrollRef.current?.scrollTo({ y: i * WHEEL_ITEM_H, animated: true });
                onIndexChange(i);
              }}
            >
              <Text style={[wStyles.itemText, { opacity, fontSize, fontFamily, transform: [{ scale }] }]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const wStyles = StyleSheet.create({
  column: { flex: 1, height: WHEEL_H, overflow: "hidden" },
  item: { height: WHEEL_ITEM_H, alignItems: "center", justifyContent: "center" },
  itemText: { color: "#fff", textAlign: "center" },
});

// Build a 6-week calendar grid (sun-first) for a given month
function buildCalendarGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({
  value,
  min,
  max,
  onChange,
  colors,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  colors: ReturnType<typeof useColors>;
  ariaLabel: string;
}) {
  const decDisabled = value <= min;
  const incDisabled = value >= max;
  return (
    <View style={styles.stepperControl}>
      <TouchableOpacity
        accessibilityLabel={`Decrease ${ariaLabel}`}
        onPress={() => !decDisabled && onChange(value - 1)}
        style={[styles.stepperBtn, { backgroundColor: colors.secondary, opacity: decDisabled ? 0.35 : 1 }]}
        disabled={decDisabled}
      >
        <Feather name="minus" size={16} color={colors.primary} />
      </TouchableOpacity>
      <Text style={[styles.stepperValue, { color: colors.foreground }]}>{value}</Text>
      <TouchableOpacity
        accessibilityLabel={`Increase ${ariaLabel}`}
        onPress={() => !incDisabled && onChange(value + 1)}
        style={[styles.stepperBtn, { backgroundColor: colors.secondary, opacity: incDisabled ? 0.35 : 1 }]}
        disabled={incDisabled}
      >
        <Feather name="plus" size={16} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

// ─── DriverTripCard — preview/output ──────────────────────────────────────────
function DriverTripCard({
  driverName,
  from,
  to,
  date,
  time,
  message,
  seats,
  luggage,
  pricePerSeat,
  colors,
}: {
  driverName: string;
  from: string;
  to: string;
  date: string;
  time: string;
  message: string;
  seats: number;
  luggage: number;
  pricePerSeat: number;
  colors: ReturnType<typeof useColors>;
}) {
  const initials = driverName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <View style={[styles.tripCard, CARD_SHADOW]}>
      {/* Header */}
      <View style={styles.tripHeader}>
        <View style={[styles.tripAvatar, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.tripInitials, { color: colors.primary }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.tripNameRow}>
            <Text style={[styles.tripName, { color: colors.foreground }]}>{driverName}</Text>
            <View style={[styles.topBadge, { backgroundColor: "#FEF3E2" }]}>
              <Feather name="award" size={9} color="#C4954A" />
              <Text style={[styles.topBadgeText, { color: "#C4954A" }]}>Top Voyager</Text>
            </View>
          </View>
          <View style={styles.tripMetaRow}>
            <Feather name="star" size={10} color="#C4954A" />
            <Text style={[styles.tripMetaText, { color: colors.mutedForeground }]}>4.9 · 12 trips · Just now</Text>
          </View>
        </View>
      </View>

      {/* Route */}
      <View style={styles.routeBlock}>
        <View style={styles.routeEnd}>
          <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.routeCity, { color: colors.foreground }]}>{from || "From"}</Text>
        </View>
        <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
        <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
        <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
        <View style={[styles.routeEnd, { justifyContent: "flex-end" }]}>
          <View style={[styles.routeDot, { backgroundColor: colors.accent }]} />
          <Text style={[styles.routeCity, { color: colors.foreground }]}>{to || "To"}</Text>
        </View>
      </View>

      {/* Message */}
      {message.trim().length > 0 && (
        <Text style={[styles.tripMessage, { color: colors.mutedForeground }]} numberOfLines={3}>
          {message.trim()}
        </Text>
      )}

      {/* Bottom chips */}
      <View style={styles.chipRow}>
        <View style={[styles.chip, { backgroundColor: colors.muted }]}>
          <Feather name="calendar" size={11} color={colors.mutedForeground} />
          <Text style={[styles.chipText, { color: colors.foreground }]}>{date}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.muted }]}>
          <Feather name="clock" size={11} color={colors.mutedForeground} />
          <Text style={[styles.chipText, { color: colors.foreground }]}>{time}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.muted }]}>
          <Feather name="users" size={11} color={colors.mutedForeground} />
          <Text style={[styles.chipText, { color: colors.foreground }]}>{seats} seat{seats !== 1 ? "s" : ""}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.muted }]}>
          <Feather name="briefcase" size={11} color={colors.mutedForeground} />
          <Text style={[styles.chipText, { color: colors.foreground }]}>{luggage} bag{luggage !== 1 ? "s" : ""}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: "#F0FAF4" }]}>
          <Text style={[styles.chipPrice, { color: colors.primary }]}>${pricePerSeat}/seat</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main composer screen ─────────────────────────────────────────────────────
export default function PostTrip() {
  const colors = useColors();
  const router = useRouter();

  const [fromCity, setFromCity] = useState<string>(MVP_CITIES[0]);
  const [fromNeighborhood, setFromNeighborhood] = useState<string>("");
  const [toCity, setToCity] = useState<string>(MVP_CITIES[1]);
  const [toNeighborhood, setToNeighborhood] = useState<string>("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [seats, setSeats] = useState(2);
  const [luggage, setLuggage] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const [pickerTarget, setPickerTarget] = useState<"from" | "to" | null>(null);
  const [pickerStep, setPickerStep] = useState<"city" | "neighborhood">("city");
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerTempCity, setPickerTempCity] = useState("");
  const [wheelHour, setWheelHour] = useState(8);    // index into WHEEL_HOURS; 8 = "9"
  const [wheelMinute, setWheelMinute] = useState(0); // index into WHEEL_MINUTES; 0 = "00"
  const [wheelPeriod, setWheelPeriod] = useState(0); // 0 = AM
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(date.getFullYear(), date.getMonth(), 1));

  // Auto-calculated price (uses shared IRS utility)
  const miles = getDistanceMiles(fromCity, toCity);
  const pricePerSeat = useMemo(() => calculateSuggestedPrice(fromCity, toCity, seats), [fromCity, toCity, seats]);

  // Display strings for the location buttons and preview card
  const displayFrom = fromCity
    ? fromNeighborhood ? `${fromCity} — ${fromNeighborhood}` : fromCity
    : "";
  const displayTo = toCity
    ? toNeighborhood ? `${toCity} — ${toNeighborhood}` : toCity
    : "";

  // Validation
  const sameLocation =
    fromCity === toCity && (fromNeighborhood || "") === (toNeighborhood || "") && !!fromCity;
  const messageTrimmed = message.trim();
  const dateInPast = startOfDay(date).getTime() < startOfDay(new Date()).getTime();

  const fromUnsupported = !!fromCity && !isMvpCity(fromCity);
  const toUnsupported = !!toCity && !isMvpCity(toCity);

  const errors = {
    from: touched && !fromCity
      ? "Please choose a starting city."
      : touched && fromUnsupported
      ? "This city isn't available yet."
      : touched && fromCity && !fromNeighborhood
      ? "Please choose a neighborhood."
      : "",
    to: touched && !toCity
      ? "Please choose a destination."
      : touched && toUnsupported
      ? "This city isn't available yet."
      : touched && toCity && !toNeighborhood
      ? "Please choose a neighborhood."
      : touched && sameLocation
      ? "From and To must be different."
      : "",
    message: touched && messageTrimmed.length === 0 ? "Please write a short post message." : "",
    date: touched && dateInPast ? "Date must be today or later." : "",
  };

  const isValid =
    !!fromCity &&
    !!fromNeighborhood &&
    !!toCity &&
    !!toNeighborhood &&
    !sameLocation &&
    !fromUnsupported &&
    !toUnsupported &&
    messageTrimmed.length > 0 &&
    !dateInPast &&
    seats >= 1 &&
    seats <= MAX_SEATS &&
    luggage >= 0 &&
    luggage <= MAX_LUGGAGE;

  async function handlePost() {
    setTouched(true);
    if (!isValid) return;
    setSubmitting(true);
    const departure = new Date(date);
    const h12 = wheelHour + 1;
    const h24 = wheelPeriod === 0 ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12);
    departure.setHours(h24, wheelMinute * 5, 0, 0);
    try {
      await createTrip({
        fromCity: fromCity,
        toCity: toCity,
        departureAt: departure.toISOString(),
        seatsAvailable: seats,
        luggageSpace: luggage,
        pricePerSeat,
        note: messageTrimmed,
      });
      Alert.alert("Adventure Posted!", "Your trip is now live on the feed. Sailors can reply to join.", [
        { text: "View Feed", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (err) {
      Alert.alert(
        "Couldn't post trip",
        err instanceof Error ? err.message : "Please try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Location picker ────────────────────────────────────────────────────────
  function openPicker(target: "from" | "to") {
    setPickerTarget(target);
    setPickerStep("city");
    setPickerSearch("");
    setPickerTempCity("");
  }

  function handleCitySelect(city: string, comingSoon: boolean) {
    if (comingSoon) {
      Alert.alert(
        `${city} — Coming Soon`,
        "We're starting with the Austin ↔ Houston corridor. We'll let you know when this city goes live.",
      );
      return;
    }
    setPickerTempCity(city);
    setPickerStep("neighborhood");
    setPickerSearch("");
  }

  function handleNeighborhoodSelect(nbhd: string) {
    if (pickerTarget === "from") {
      setFromCity(pickerTempCity);
      setFromNeighborhood(nbhd);
    } else if (pickerTarget === "to") {
      setToCity(pickerTempCity);
      setToNeighborhood(nbhd);
    }
    setPickerTarget(null);
  }

  function handlePickerBack() {
    setPickerStep("city");
    setPickerSearch("");
  }

  // ─── Calendar sheet ─────────────────────────────────────────────────────────
  const cells = buildCalendarGrid(calendarMonth.getFullYear(), calendarMonth.getMonth());
  const today = startOfDay(new Date());

  function selectDate(d: Date) {
    setDate(d);
    setCalendarOpen(false);
  }

  function shiftMonth(delta: number) {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1));
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Post an Adventure</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* IRS notice */}
          <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
            <Feather name="navigation" size={14} color={colors.primary} />
            <Text style={[styles.noticeText, { color: colors.primary }]}>
              Price auto-calculated: (miles × $0.67 × 0.75) ÷ seats. You may not charge above actual costs.
            </Text>
          </View>

          {/* Composer card */}
          <View style={[styles.card, CARD_SHADOW]}>
            <Field label="From Location" error={errors.from}>
              <TouchableOpacity
                style={[
                  styles.inputBtn,
                  {
                    backgroundColor: colors.muted,
                    borderColor: errors.from ? colors.destructive : "transparent",
                    borderWidth: errors.from ? 1.5 : 0,
                    height: fromNeighborhood ? 60 : 50,
                  },
                ]}
                onPress={() => openPicker("from")}
              >
                <View style={[styles.inputDot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputText, { color: fromCity ? colors.foreground : colors.mutedForeground }]}>
                    {fromCity || "Select city…"}
                  </Text>
                  {fromNeighborhood ? (
                    <Text style={[styles.inputNeighborhood, { color: colors.mutedForeground }]}>
                      {fromNeighborhood}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </Field>

            <Field label="To Location" error={errors.to}>
              <TouchableOpacity
                style={[
                  styles.inputBtn,
                  {
                    backgroundColor: colors.muted,
                    borderColor: errors.to ? colors.destructive : "transparent",
                    borderWidth: errors.to ? 1.5 : 0,
                    height: toNeighborhood ? 60 : 50,
                  },
                ]}
                onPress={() => openPicker("to")}
              >
                <View style={[styles.inputDot, { backgroundColor: colors.accent }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputText, { color: toCity ? colors.foreground : colors.mutedForeground }]}>
                    {toCity || "Select city…"}
                  </Text>
                  {toNeighborhood ? (
                    <Text style={[styles.inputNeighborhood, { color: colors.mutedForeground }]}>
                      {toNeighborhood}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </Field>

            <Field label="Post" error={errors.message}>
              <TextInput
                style={[
                  styles.textarea,
                  {
                    backgroundColor: colors.muted,
                    color: colors.foreground,
                    borderColor: errors.message ? colors.destructive : "transparent",
                    borderWidth: errors.message ? 1.5 : 0,
                  },
                ]}
                placeholder="Heading to Austin for the weekend! Clean car, good music, and friendly vibes."
                placeholderTextColor={colors.mutedForeground}
                value={message}
                onChangeText={(t) => setMessage(t.slice(0, MAX_MESSAGE))}
                onBlur={() => setTouched(true)}
                multiline
                textAlignVertical="top"
                maxLength={MAX_MESSAGE}
              />
              <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
                {message.length}/{MAX_MESSAGE}
              </Text>
            </Field>

            <Field label="Date of Travel" error={errors.date}>
              <TouchableOpacity
                style={[
                  styles.inputBtn,
                  {
                    backgroundColor: colors.muted,
                    borderColor: errors.date ? colors.destructive : "transparent",
                    borderWidth: errors.date ? 1.5 : 0,
                  },
                ]}
                onPress={() => setCalendarOpen(true)}
              >
                <Feather name="calendar" size={16} color={colors.primary} />
                <Text style={[styles.inputText, { color: colors.foreground }]}>{formatDate(date)}</Text>
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </Field>

            <Field label="Estimated Start Time" error="">
              <TouchableOpacity
                style={[styles.inputBtn, { backgroundColor: colors.muted }]}
                onPress={() => setTimePickerOpen(true)}
              >
                <Feather name="clock" size={16} color={colors.primary} />
                <Text style={[styles.inputText, { color: colors.foreground }]}>
                  {WHEEL_HOURS[wheelHour]}:{WHEEL_MINUTES[wheelMinute]} {WHEEL_PERIODS[wheelPeriod]}
                </Text>
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </Field>

            <View style={[styles.stepperRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.stepperLabel, { color: colors.foreground }]}>No of Seats Available</Text>
              <Stepper value={seats} min={1} max={MAX_SEATS} onChange={setSeats} colors={colors} ariaLabel="seats" />
            </View>
            <View style={[styles.stepperRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.stepperLabel, { color: colors.foreground }]}>No of Luggage Space Available</Text>
              <Stepper value={luggage} min={0} max={MAX_LUGGAGE} onChange={setLuggage} colors={colors} ariaLabel="luggage spaces" />
            </View>

            {/* Auto-calculated price */}
            <View style={[styles.priceRow, { borderTopColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepperLabel, { color: colors.foreground }]}>Amount Per Seat</Text>
                <Text style={[styles.priceCalc, { color: colors.mutedForeground }]}>
                  {miles > 0 ? `${miles} mi × $0.67 × 0.75 ÷ ${seats} = ` : "Choose two different cities to calculate"}
                  {miles > 0 ? <Text style={{ fontFamily: "Inter_600SemiBold" }}>auto</Text> : null}
                </Text>
              </View>
              <View style={[styles.priceBadge, { backgroundColor: "#F0FAF4" }]}>
                <Text style={[styles.priceBadgeText, { color: colors.primary }]}>${pricePerSeat}/seat</Text>
              </View>
            </View>

            {/* Refund policy disclaimer */}
            <View style={[styles.refundNotice, { backgroundColor: "#FFF8EC", borderColor: "#F0C97A" }]}>
              <Feather name="info" size={15} color={colors.accent} style={{ marginTop: 1 }} />
              <Text style={[styles.refundNoticeText, { color: "#7A5A1E" }]}>
                <Text style={{ fontFamily: "Inter_600SemiBold" }}>Refund Policy: </Text>
                Sailors receive a full refund only if the Adventure is cancelled by the Voyager or Sailor at least{" "}
                <Text style={{ fontFamily: "Inter_600SemiBold" }}>6 hours before</Text> the scheduled start time.
                Cancellations after that window are non-refundable.
              </Text>
            </View>

            {/* Post button */}
            <TouchableOpacity
              style={[
                styles.postBtn,
                {
                  backgroundColor: isValid ? colors.primary : colors.muted,
                  opacity: submitting ? 0.7 : 1,
                },
              ]}
              onPress={handlePost}
              disabled={!isValid || submitting}
              activeOpacity={0.88}
              accessibilityLabel="Post trip"
            >
              {submitting ? (
                <Text style={[styles.postBtnText, { color: "#fff" }]}>Posting…</Text>
              ) : (
                <>
                  <Feather name="send" size={16} color={isValid ? "#fff" : colors.mutedForeground} />
                  <Text style={[styles.postBtnText, { color: isValid ? "#fff" : colors.mutedForeground }]}>Post Adventure</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Live preview */}
          <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>PREVIEW</Text>
          <DriverTripCard
            driverName="You"
            from={displayFrom || "From"}
            to={displayTo || "To"}
            date={formatDate(date)}
            time={`${WHEEL_HOURS[wheelHour]}:${WHEEL_MINUTES[wheelMinute]} ${WHEEL_PERIODS[wheelPeriod]}`}
            message={messageTrimmed || "Your trip message will appear here…"}
            seats={seats}
            luggage={luggage}
            pricePerSeat={pricePerSeat}
            colors={colors}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Time picker modal — premium wheel style */}
      <Modal visible={timePickerOpen} transparent animationType="slide" onRequestClose={() => setTimePickerOpen(false)}>
        <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.82)" }]}>
          <View style={styles.wheelSheet}>
            {/* Handle */}
            <View style={styles.wheelHandle} />

            {/* Header row */}
            <View style={styles.wheelHeader}>
              <TouchableOpacity onPress={() => setTimePickerOpen(false)} hitSlop={12}>
                <Text style={styles.wheelCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.wheelTitle}>Departure Time</Text>
              <TouchableOpacity onPress={() => setTimePickerOpen(false)} hitSlop={12}>
                <Text style={styles.wheelDoneText}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Wheel columns */}
            <View style={styles.wheelBody}>
              {/* Center selection highlight */}
              <View style={styles.wheelHighlight} pointerEvents="none" />

              <WheelColumn items={WHEEL_HOURS} index={wheelHour} onIndexChange={setWheelHour} />

              <Text style={styles.wheelColon}>:</Text>

              <WheelColumn items={WHEEL_MINUTES} index={wheelMinute} onIndexChange={setWheelMinute} />

              <View style={styles.wheelPeriodGap} />

              <WheelColumn items={WHEEL_PERIODS} index={wheelPeriod} onIndexChange={setWheelPeriod} />
            </View>

            {/* Live preview */}
            <View style={styles.wheelPreviewRow}>
              <Text style={styles.wheelPreviewLabel}>Departure at</Text>
              <Text style={styles.wheelPreviewValue}>
                {WHEEL_HOURS[wheelHour]}:{WHEEL_MINUTES[wheelMinute]} {WHEEL_PERIODS[wheelPeriod]}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Location picker modal — 2-step: city → neighborhood */}
      <Modal visible={!!pickerTarget} transparent animationType="slide" onRequestClose={() => setPickerTarget(null)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card, maxHeight: "80%" }]}>
            <View style={styles.sheetHandle} />

            {/* Sheet header */}
            <View style={styles.pickerHeader}>
              {pickerStep === "neighborhood" ? (
                <TouchableOpacity onPress={handlePickerBack} style={styles.pickerBackBtn}>
                  <Feather name="arrow-left" size={18} color={colors.foreground} />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 36 }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.foreground, marginBottom: 0 }]}>
                  {pickerTarget === "from" ? "From Location" : "To Location"}
                </Text>
                {pickerStep === "neighborhood" && (
                  <Text style={[styles.pickerSubtitle, { color: colors.mutedForeground }]}>
                    {pickerTempCity}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setPickerTarget(null)} style={styles.pickerBackBtn}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Search input */}
            <View style={[styles.searchBox, { backgroundColor: colors.muted }]}>
              <Feather name="search" size={15} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder={pickerStep === "city" ? "Search cities…" : "Search neighborhoods…"}
                placeholderTextColor={colors.mutedForeground}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoFocus
                clearButtonMode="while-editing"
              />
            </View>

            {/* Step 1 — city list */}
            {pickerStep === "city" && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {ALL_CITY_OPTIONS.filter((o) =>
                  !pickerSearch.trim() || o.label.toLowerCase().includes(pickerSearch.toLowerCase())
                ).map((option) => {
                  const isSelected =
                    (pickerTarget === "from" && fromCity === option.label) ||
                    (pickerTarget === "to" && toCity === option.label);
                  const comingSoon = option.status === "coming-soon";
                  return (
                    <TouchableOpacity
                      key={option.label}
                      style={[
                        styles.pickerRow,
                        { borderBottomColor: colors.border, opacity: comingSoon ? 0.55 : 1 },
                      ]}
                      onPress={() => handleCitySelect(option.label, comingSoon)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickerText, { color: colors.foreground }]}>{option.label}</Text>
                        {!comingSoon && (
                          <Text style={[styles.pickerMeta, { color: colors.mutedForeground }]}>
                            {getNeighborhoods(option.label).length} neighborhoods
                          </Text>
                        )}
                      </View>
                      {comingSoon ? (
                        <View style={[styles.comingSoonBadge, { backgroundColor: colors.muted }]}>
                          <Text style={[styles.comingSoonText, { color: colors.mutedForeground }]}>
                            Coming soon
                          </Text>
                        </View>
                      ) : isSelected ? (
                        <Feather name="check" size={16} color={colors.primary} />
                      ) : (
                        <Feather name="chevron-right" size={16} color={colors.border} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Step 2 — neighborhood list */}
            {pickerStep === "neighborhood" && (() => {
              const allNbhds = getNeighborhoods(pickerTempCity);
              const filtered = filterNeighborhoods(allNbhds, pickerSearch);
              const currentNbhd =
                pickerTarget === "from" && fromCity === pickerTempCity ? fromNeighborhood :
                pickerTarget === "to" && toCity === pickerTempCity ? toNeighborhood : "";
              return (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {filtered.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                        No neighborhoods match "{pickerSearch}"
                      </Text>
                    </View>
                  ) : filtered.map((nbhd) => {
                    const isSelected = currentNbhd === nbhd;
                    return (
                      <TouchableOpacity
                        key={nbhd}
                        style={[styles.pickerRow, { borderBottomColor: colors.border }]}
                        onPress={() => handleNeighborhoodSelect(nbhd)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.nbhdDot, {
                          backgroundColor: pickerTarget === "from" ? colors.primary : colors.accent,
                        }]} />
                        <Text style={[styles.pickerText, { color: colors.foreground, flex: 1 }]}>{nbhd}</Text>
                        {isSelected && <Feather name="check" size={16} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Calendar modal */}
      <Modal visible={calendarOpen} transparent animationType="slide" onRequestClose={() => setCalendarOpen(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card, maxHeight: "75%" }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.calendarNavBtn}>
                <Feather name="chevron-left" size={18} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.calendarMonth, { color: colors.foreground }]}>
                {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </Text>
              <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.calendarNavBtn}>
                <Feather name="chevron-right" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <Text key={i} style={[styles.weekLabel, { color: colors.mutedForeground }]}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {cells.map((cell, i) => {
                if (!cell) return <View key={i} style={styles.calendarCell} />;
                const isPast = startOfDay(cell).getTime() < today.getTime();
                const isSelected = startOfDay(cell).getTime() === startOfDay(date).getTime();
                const isToday = startOfDay(cell).getTime() === today.getTime();
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.calendarCell,
                      isSelected && { backgroundColor: colors.primary, borderRadius: 12 },
                    ]}
                    onPress={() => !isPast && selectDate(cell)}
                    disabled={isPast}
                  >
                    <Text
                      style={[
                        styles.calendarDay,
                        {
                          color: isSelected
                            ? "#fff"
                            : isPast
                            ? colors.border
                            : isToday
                            ? colors.primary
                            : colors.foreground,
                          fontFamily: isToday || isSelected ? "Inter_700Bold" : "Inter_500Medium",
                        },
                      ]}
                    >
                      {cell.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.calendarClose, { backgroundColor: colors.muted }]}
              onPress={() => setCalendarOpen(false)}
            >
              <Text style={[styles.calendarCloseText, { color: colors.foreground }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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

  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },

  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 14, borderRadius: 14 },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  card: { backgroundColor: "#fff", borderRadius: 22, padding: 20, gap: 16 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: -0.1 },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },

  inputBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
  },
  inputDot: { width: 10, height: 10, borderRadius: 5 },
  inputText: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },

  textarea: {
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    minHeight: 110,
  },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right", marginTop: 2 },

  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    borderTopWidth: 1,
  },
  stepperLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  stepperControl: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepperBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  stepperValue: { fontSize: 18, fontFamily: "Inter_700Bold", minWidth: 24, textAlign: "center" },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  priceCalc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  priceBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  priceBadgeText: { fontSize: 15, fontFamily: "Inter_700Bold" },

  postBtn: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  postBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Preview
  previewLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  tripCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, gap: 14 },
  tripHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  tripAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  tripInitials: { fontSize: 15, fontFamily: "Inter_700Bold" },
  tripNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tripName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  topBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  topBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  tripMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  tripMetaText: { fontSize: 11, fontFamily: "Inter_400Regular" },

  routeBlock: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeEnd: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeCity: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  routeLine: { flex: 1, height: 1 },

  tripMessage: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  chipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  chipPrice: { fontSize: 11, fontFamily: "Inter_700Bold" },

  inputNeighborhood: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },

  // Modals
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12, maxHeight: "65%" },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E3DDD3", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", marginBottom: 12 },

  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  pickerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },

  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  pickerText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  pickerMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },

  comingSoonBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  comingSoonText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },

  nbhdDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },

  emptyState: { paddingVertical: 32, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },

  // Calendar
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  calendarNavBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  calendarMonth: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  weekRow: { flexDirection: "row", marginBottom: 8 },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  calendarDay: { fontSize: 14 },
  calendarClose: { marginTop: 12, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  calendarCloseText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Wheel time picker — uses app primary palette
  wheelSheet: {
    backgroundColor: "#1B3D2F",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 36,
    overflow: "hidden",
  },
  wheelHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(248,247,243,0.25)", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  wheelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(248,247,243,0.1)",
  },
  wheelTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#F8F7F3", letterSpacing: -0.2 },
  wheelCancelText: { fontSize: 15, fontFamily: "Inter_400Regular", color: "rgba(248,247,243,0.45)" },
  wheelDoneText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#C4954A" },
  wheelBody: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: WHEEL_H,
    position: "relative",
  },
  wheelHighlight: {
    position: "absolute",
    left: 12,
    right: 12,
    top: WHEEL_ITEM_H * 2,
    height: WHEEL_ITEM_H,
    backgroundColor: "rgba(248,247,243,0.1)",
    borderRadius: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(248,247,243,0.18)",
  },
  wheelColon: { color: "rgba(248,247,243,0.55)", fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 2, marginHorizontal: 2 },
  wheelPeriodGap: { width: 8 },
  wheelPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(248,247,243,0.1)",
    marginTop: 4,
  },
  wheelPreviewLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(248,247,243,0.45)" },
  wheelPreviewValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#C4954A", letterSpacing: -0.5 },

  // Refund disclaimer
  refundNotice: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 4 },
  refundNoticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
