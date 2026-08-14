import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Alert } from "@/lib/alert";
import { StripeProvider, useStripe } from "@/lib/stripeNative";

import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";
import { getTrip } from "@/lib/trips";
import {
  confirmBooking,
  createBooking,
  computeServiceFee,
  prepareBooking,
} from "@/lib/bookings";
import {
  formatUsd,
  INSURANCE_PREMIUM_PER_SEAT,
  LUGGAGE_INSURANCE_PREMIUM,
  LUGGAGE_SURCHARGE,
  LUGGAGE_TIER_LABELS,
  type LuggageTier,
} from "@/lib/pricing";
import type { Trip } from "@/data/trips";

const PAYMENT_METHODS = [
  {
    id: "card" as const,
    icon: "credit-card",
    label: "Credit / Debit Card",
    sub: "Visa, Mastercard, Amex",
    badge: "Stripe",
  },
  {
    id: "apple" as const,
    icon: "smartphone",
    label: "Apple Pay",
    sub: "Pay with Face ID",
    badge: "Fast",
  },
];

type PaymentMethodId = (typeof PAYMENT_METHODS)[number]["id"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cityShort(c: string): string {
  return c.replace(/, TX$/, "").replace(/, AR$/, "");
}

function PaymentBody() {
  const colors = useColors();
  const router = useRouter();
  const stripe = useStripe();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [tripLoading, setTripLoading] = useState(true);
  const [tripError, setTripError] = useState<string | null>(null);

  const [selected, setSelected] = useState<PaymentMethodId>("card");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!tripId) {
      setTripLoading(false);
      setTripError("No trip selected. Please pick a trip first.");
      return;
    }
    setTripLoading(true);
    setTripError(null);
    getTrip(tripId)
      .then(({ trip }) => {
        if (!cancelled) {
          setTrip(trip);
          setTripLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setTripError(err?.message || "Couldn't load trip.");
          setTripLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const seats = 1;
  // Trip insurance starts ON — the Sailor must actively remove it.
  const [insuranceOn, setInsuranceOn] = useState(true);
  const [luggageTier, setLuggageTier] = useState<LuggageTier>("carry_on");
  const [luggageCoverOn, setLuggageCoverOn] = useState(false);

  const seatCost = trip ? Number(trip.pricePerSeat) : 0;
  const seatSubtotal = round2(seatCost * seats);
  const surcharge = LUGGAGE_SURCHARGE[luggageTier];
  const insuranceCost = insuranceOn ? round2(INSURANCE_PREMIUM_PER_SEAT * seats) : 0;
  const luggageCoverPrice = LUGGAGE_INSURANCE_PREMIUM[luggageTier];
  const luggageCoverAvailable = luggageCoverPrice > 0;
  const luggageCoverCost = luggageCoverOn && luggageCoverAvailable ? luggageCoverPrice : 0;

  const subtotal = round2(seatSubtotal + surcharge + insuranceCost + luggageCoverCost);
  const fee = computeServiceFee(subtotal);
  const total = round2(subtotal + fee);

  // Carry-on has no cover to sell, so drop any stale selection.
  useEffect(() => {
    if (!luggageCoverAvailable && luggageCoverOn) setLuggageCoverOn(false);
  }, [luggageCoverAvailable, luggageCoverOn]);

  async function handlePay() {
    if (!trip || paying) return;
    setPaying(true);
    try {
      try {
        const prepared = await prepareBooking({
          tripId: trip.id,
          seats,
          paymentMethod: selected,
          luggageTier,
          insuranceOptedIn: insuranceOn,
          luggageInsuranceOptedIn: luggageCoverOn && luggageCoverAvailable,
        });

        if (prepared.clientSecret && Platform.OS !== "web") {
          const init = await stripe.initPaymentSheet({
            merchantDisplayName: "Bovogo",
            paymentIntentClientSecret: prepared.clientSecret,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
          if (init.error) throw new Error(init.error.message);

          const present = await stripe.presentPaymentSheet();
          if (present.error) {
            if (present.error.code === "Canceled") {
              setPaying(false);
              return;
            }
            throw new Error(present.error.message);
          }

          const confirmed = await confirmBooking(prepared.booking.id);
          router.replace({
            pathname: "/booking-confirmed",
            params: { id: confirmed.id },
          });
          return;
        }

        // Web or no client secret — confirm if already paid (unlikely) or error.
        throw new Error(
          "Card payment requires the iOS or Android app (Expo Go or a build).",
        );
      } catch (err: any) {
        const msg = String(err?.message ?? "");
        const notConfigured =
          msg.toLowerCase().includes("not configured") ||
          msg.toLowerCase().includes("payments are not configured");
        if (!notConfigured) throw err;

        // Local dev without Stripe keys: instant confirm (no charge).
        const booking = await createBooking({
          tripId: trip.id,
          seats,
          paymentMethod: selected,
          luggageTier,
          insuranceOptedIn: insuranceOn,
          luggageInsuranceOptedIn: luggageCoverOn && luggageCoverAvailable,
        });
        router.replace({
          pathname: "/booking-confirmed",
          params: { id: booking.id },
        });
      }
    } catch (err: any) {
      setPaying(false);
      Alert.alert(
        "Booking failed",
        err?.message || "We couldn't complete your booking. Please try again.",
      );
    }
  }

  if (tripLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={[styles.centered, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (tripError || !trip) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Payment</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
            {tripError || "Adventure unavailable."}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.retryText}>Browse adventures</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const route = `${cityShort(trip.fromCity)} → ${cityShort(trip.toCity)}`;

  return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Payment</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.summaryCard, CARD_SHADOW]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              ADVENTURE SUMMARY
            </Text>
            <View style={styles.summaryRows}>
              {[
                { label: "Route", value: route },
                { label: "Date", value: formatDate(trip.departureAt) },
                { label: "Voyager", value: trip.driver.name },
                { label: "Seats", value: `${seats} seat` },
              ].map((row, i) => (
                <View key={row.label}>
                  {i > 0 && (
                    <View style={[styles.rowDiv, { backgroundColor: colors.border }]} />
                  )}
                  <View style={styles.summaryRow}>
                    <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>
                      {row.label}
                    </Text>
                    <Text style={[styles.rowValue, { color: colors.foreground }]}>
                      {row.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.totalBlock, { borderTopColor: colors.border }]}>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
                  {seats} seat{seats === 1 ? "" : "s"} × {formatUsd(seatCost)}
                </Text>
                <Text style={[styles.totalValue, { color: colors.foreground }]}>
                  ${seatSubtotal.toFixed(2)}
                </Text>
              </View>

              {surcharge > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
                    Luggage — {LUGGAGE_TIER_LABELS[luggageTier].title}
                  </Text>
                  <Text style={[styles.totalValue, { color: colors.foreground }]}>
                    ${surcharge.toFixed(2)}
                  </Text>
                </View>
              ) : null}

              {/* Trip insurance is default-on. Per the pricing spec the line
                  must be visible before capture with an adjacent Remove that
                  works on one tap — no confirmation modal. */}
              {insuranceOn ? (
                <View style={styles.totalRow}>
                  <View style={styles.insuranceLabelBlock}>
                    <Text style={[styles.totalLabel, { color: colors.foreground }]}>
                      Trip insurance — {formatUsd(INSURANCE_PREMIUM_PER_SEAT)}
                      {seats > 1 ? ` × ${seats}` : ""}
                    </Text>
                    <Text style={[styles.insuranceDetail, { color: colors.mutedForeground }]}>
                      Covers accidental injury and luggage loss during your trip.
                    </Text>
                    <TouchableOpacity
                      onPress={() => setInsuranceOn(false)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Remove trip insurance"
                    >
                      <Text style={[styles.removeLink, { color: colors.destructive }]}>
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.totalValue, { color: colors.foreground }]}>
                    ${insuranceCost.toFixed(2)}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.totalRow}
                  onPress={() => setInsuranceOn(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add trip insurance"
                >
                  <View style={styles.insuranceLabelBlock}>
                    <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
                      Trip insurance
                    </Text>
                    <Text style={[styles.insuranceDetail, { color: colors.mutedForeground }]}>
                      You're travelling without cover.
                    </Text>
                  </View>
                  <Text style={[styles.removeLink, { color: colors.primary }]}>Add</Text>
                </TouchableOpacity>
              )}

              {luggageCoverAvailable ? (
                <TouchableOpacity
                  style={styles.totalRow}
                  onPress={() => setLuggageCoverOn((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    luggageCoverOn ? "Remove luggage cover" : "Add luggage cover"
                  }
                >
                  <View style={styles.insuranceLabelBlock}>
                    <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
                      Luggage cover — {formatUsd(luggageCoverPrice)}
                    </Text>
                    <Text style={[styles.insuranceDetail, { color: colors.mutedForeground }]}>
                      Optional protection for your bags.
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.removeLink,
                      { color: luggageCoverOn ? colors.destructive : colors.primary },
                    ]}
                  >
                    {luggageCoverOn ? "Remove" : "Add"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
                  Bovogo fee
                </Text>
                <Text style={[styles.totalValue, { color: colors.foreground }]}>
                  ${fee.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={[styles.grandLabel, { color: colors.foreground }]}>Total</Text>
                <Text style={[styles.grandValue, { color: colors.primary }]}>
                  ${total.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            WHAT ARE YOU BRINGING?
          </Text>
          <View style={styles.luggageList}>
            {(Object.keys(LUGGAGE_TIER_LABELS) as LuggageTier[]).map((tier) => {
              const active = tier === luggageTier;
              const price = LUGGAGE_SURCHARGE[tier];
              return (
                <TouchableOpacity
                  key={tier}
                  style={[
                    styles.luggageOption,
                    {
                      backgroundColor: active ? colors.secondary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setLuggageTier(tier)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[styles.radio, { borderColor: active ? colors.primary : colors.border }]}
                  >
                    {active ? (
                      <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.luggageTitle, { color: colors.foreground }]}>
                      {LUGGAGE_TIER_LABELS[tier].title}
                    </Text>
                    <Text style={[styles.luggageDetail, { color: colors.mutedForeground }]}>
                      {LUGGAGE_TIER_LABELS[tier].detail}
                    </Text>
                  </View>
                  <Text style={[styles.luggagePrice, { color: colors.foreground }]}>
                    {price === 0 ? "Included" : `+${formatUsd(price)}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.luggageNote, { color: colors.mutedForeground }]}>
            The luggage surcharge goes entirely to your Voyager — it covers the extra
            fuel and the trunk space they're giving up.
          </Text>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            PAYMENT METHOD
          </Text>
          <View style={styles.methodList}>
            {PAYMENT_METHODS.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodCard,
                  {
                    backgroundColor:
                      selected === method.id ? colors.secondary : colors.card,
                    borderColor:
                      selected === method.id ? colors.primary : colors.border,
                    borderWidth: selected === method.id ? 2 : 1,
                  },
                  CARD_SHADOW,
                ]}
                onPress={() => setSelected(method.id)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.methodIcon,
                    {
                      backgroundColor:
                        selected === method.id ? colors.primary : colors.muted,
                    },
                  ]}
                >
                  <Feather
                    name={method.icon as any}
                    size={18}
                    color={selected === method.id ? "#fff" : colors.mutedForeground}
                  />
                </View>
                <View style={styles.methodInfo}>
                  <Text style={[styles.methodLabel, { color: colors.foreground }]}>
                    {method.label}
                  </Text>
                  <Text style={[styles.methodSub, { color: colors.mutedForeground }]}>
                    {method.sub}
                  </Text>
                </View>
                {method.badge && (
                  <View style={[styles.methodBadge, { backgroundColor: "#EBF2ED" }]}>
                    <Text style={[styles.methodBadgeText, { color: colors.primary }]}>
                      {method.badge}
                    </Text>
                  </View>
                )}
                {selected === method.id && (
                  <View style={[styles.checkIcon, { backgroundColor: colors.primary }]}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.stripeNote, { backgroundColor: colors.muted }]}>
            <Feather name="lock" size={13} color={colors.mutedForeground} />
            <Text style={[styles.stripeNoteText, { color: colors.mutedForeground }]}>
              Payments processed securely via Stripe. Your card details are never stored
              on Bovogo. Private group chat unlocks after payment.
            </Text>
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { backgroundColor: colors.background, borderTopColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: colors.primary, opacity: paying ? 0.8 : 1 }]}
            onPress={handlePay}
            disabled={paying}
            activeOpacity={0.88}
          >
            <Feather name="lock" size={16} color="#fff" />
            <Text style={styles.payBtnText}>
              {paying ? "Processing..." : `Pay $${total.toFixed(2)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
  );
}

export default function Payment() {
  const key =
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
    !process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY.includes("your-stripe")
      ? process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
      : "pk_test_placeholder_for_provider_mount";

  return (
    <StripeProvider publishableKey={key}>
      <PaymentBody />
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  errorText: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center" },
  retryBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24 },
  retryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  content: { paddingHorizontal: 20, gap: 14, paddingBottom: 24 },
  summaryCard: { backgroundColor: "#fff", borderRadius: 20, overflow: "hidden" },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  summaryRows: { padding: 18 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  rowDiv: { height: 1 },
  rowLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  rowValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  totalBlock: { borderTopWidth: 1, padding: 18, gap: 12 },
  insuranceLabelBlock: { flex: 1, paddingRight: 12, gap: 3 },
  insuranceDetail: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  removeLink: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  luggageList: { gap: 10, marginBottom: 10 },
  luggageOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  luggageTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  luggageDetail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  luggagePrice: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  luggageNote: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 17, marginBottom: 18 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  totalValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  grandTotalRow: { marginTop: 4 },
  grandLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  grandValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  methodList: { gap: 10 },
  methodCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  methodIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  methodInfo: { flex: 1, gap: 3 },
  methodLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  methodSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  methodBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  methodBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  checkIcon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stripeNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  stripeNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  payBtn: {
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  payBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
