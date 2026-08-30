import { showAlert } from "@/lib/alert";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { StripeProvider, useStripe } from "@/lib/stripeNative";

import type { ReceiptPrinterStage } from "@/components/ReceiptPrinter";
import { TicketPrintOverlay } from "@/components/TicketPrintOverlay";

import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";
import { getTrip } from "@/lib/trips";
import {
  confirmBooking,
  createBooking,
  computeServiceFee,
  prepareBooking,
} from "@/lib/bookings";
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

  // The printer runs over the top of checkout once the charge is away. It
  // holds on "processing" for as long as the payment actually takes.
  const [printStage, setPrintStage] = useState<ReceiptPrinterStage | null>(
    null,
  );
  const bookingIdRef = useRef<string | null>(null);
  const printTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (printTimer.current) clearTimeout(printTimer.current);
    },
    [],
  );

  /** Feed the ticket, then settle on complete once it is fully out. */
  function runPrint(bookingId: string) {
    bookingIdRef.current = bookingId;
    setPrintStage("printing");
    printTimer.current = setTimeout(() => setPrintStage("complete"), 1900);
  }

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
  const subtotal = trip ? Number(trip.pricePerSeat) * seats : 0;
  const fee = computeServiceFee(subtotal);
  const total = Math.round((subtotal + fee) * 100) / 100;

  async function handlePay() {
    if (!trip || paying) return;
    setPaying(true);
    setPrintStage("processing");
    try {
      try {
        const prepared = await prepareBooking({
          tripId: trip.id,
          seats,
          paymentMethod: selected,
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
              setPrintStage(null);
              return;
            }
            throw new Error(present.error.message);
          }

          const confirmed = await confirmBooking(prepared.booking.id);
          runPrint(confirmed.id);
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
        });
        runPrint(booking.id);
      }
    } catch (err: any) {
      setPaying(false);
      setPrintStage(null);
      showAlert(
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
                  Subtotal
                </Text>
                <Text style={[styles.totalValue, { color: colors.foreground }]}>
                  ${subtotal.toFixed(2)}
                </Text>
              </View>
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

        {printStage ? (
          <TicketPrintOverlay
            detail={`${seats} seat · ${formatDate(trip.departureAt)}`}
            onDone={() => {
              const id = bookingIdRef.current;
              if (id) {
                router.replace({
                  pathname: "/booking-confirmed",
                  params: { id },
                });
              }
            }}
            onHome={() => router.replace("/(tabs)")}
            route={route}
            stage={printStage}
            total={`$${total.toFixed(2)}`}
          />
        ) : null}
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
  totalBlock: { borderTopWidth: 1, padding: 18, gap: 8 },
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
