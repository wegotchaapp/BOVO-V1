import { PaymentBody } from "./payment";
import { StripeProvider } from "@/lib/stripeNative";
import type { Trip } from "@/data/trips";
import { Stack } from "expo-router";
import { CheckoutComplete } from "@/components/checkout/CheckoutComplete";
import React, { useState } from "react";
import { Redirect } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ReceiptPrinter } from "@/components/checkout/ReceiptPrinter";
import { TicketHistoryFan } from "@/components/checkout/TicketHistoryFan";
import { TravelTicket } from "@/components/checkout/TravelTicket";
import { HoldToConfirm } from "@/components/HoldToConfirm";
import { UndoBar } from "@/components/UndoBar";
import type { Booking } from "@/lib/bookings";
const destinations = [
  "Austin, TX",
  "Dallas, TX",
  "Houston, TX",
  "Bentonville, AR",
  "San Antonio, TX",
];
const tickets: Booking[] = destinations.map((toCity, index) => ({
  id: `preview-ticket-${index}`,
  tripId: `preview-trip-${index}`,
  riderId: "preview",
  seats: 1,
  pricePerSeat: 42,
  serviceFee: 3.18,
  totalAmount: 45.18,
  luggageTier: "carry_on",
  luggageSurcharge: 0,
  insuranceOptedIn: false,
  insurancePremium: 0,
  luggageInsuranceOptedIn: false,
  luggageInsurancePremium: 0,
  paymentMethod: "card",
  status: "confirmed",
  createdAt: "2026-09-13T10:00:00Z",
  completedAt: null,
  trip: {
    id: `preview-trip-${index}`,
    fromCity: "College Station, TX",
    toCity,
    departureAt: "2026-09-21T16:30:00Z",
    driverName: "Alex Morgan",
    car: "Toyota Camry",
  },
}));
const previewTrip: Trip = {
  id: tickets[0].tripId,
  driver: {
    id: "preview",
    name: "Alex Morgan",
    rating: 4.9,
    trips: 24,
    isTopDriver: true,
  },
  fromCity: tickets[0].trip.fromCity,
  toCity: tickets[0].trip.toCity,
  departureAt: tickets[0].trip.departureAt,
  seatsAvailable: 3,
  luggageSpace: 2,
  pricePerSeat: 42,
  note: "",
  car: "Toyota Camry",
  preferences: { smoking: false, pets: false, music: true, ac: true },
  status: "active",
  replyCount: 0,
  createdAt: tickets[0].createdAt,
};
const previewCheckout = { trip: previewTrip, booking: tickets[0] };
export default function CheckoutPreview() {
  const [tab, setTab] = useState("Checkout"),
    [replay, setReplay] = useState(0),
    [removed, setRemoved] = useState(false),
    [undo, setUndo] = useState(false);
  if (!__DEV__) return <Redirect href="/" />;
  if (tab === "Full flow")
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ padding: 12, backgroundColor: "#EBF2ED", gap: 8 }}>
          <Text style={{ textAlign: "center", color: "#1B3D2F", fontSize: 11 }}>
            REVIEW MODE · Sample data · No charges
          </Text>
          <View
            style={{ flexDirection: "row", justifyContent: "space-around" }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => setReplay(replay + 1)}
            >
              <Text>Restart checkout</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setTab("Collection")}
            >
              <Text>Review interactions →</Text>
            </Pressable>
          </View>
        </View>
        <StripeProvider publishableKey="pk_test_preview_not_used">
          <PaymentBody key={replay} preview={previewCheckout} />
        </StripeProvider>
      </View>
    );
  if (tab === "Checkout" || tab === "Printer")
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ title: "Checkout", headerShown: false }} />
        <View
          style={{
            padding: 12,
            backgroundColor: "#EBF2ED",
            flexDirection: "row",
            justifyContent: "space-around",
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setReplay(replay + 1)}
          >
            <Text>Replay checkout</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setTab("Collection")}
          >
            <Text>Review interactions →</Text>
          </Pressable>
        </View>
        <CheckoutComplete key={replay} booking={tickets[0]} />
      </View>
    );
  return (
    <View style={{ flex: 1, backgroundColor: "#F8F7F3" }}>
      <ScrollView
        contentContainerStyle={{
          paddingVertical: 48,
          alignItems: "center",
          gap: 28,
        }}
      >
        <Text style={{ color: "#1B3D2F", fontSize: 26, fontWeight: "600" }}>
          The next chapter.
        </Text>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {[
            "Full flow",
            "Checkout",
            "Printer",
            "Ticket",
            "Collection",
            "Hold",
          ].map((label) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              onPress={() => setTab(label)}
              style={{
                padding: 12,
                borderRadius: 24,
                backgroundColor: tab === label ? "#1B3D2F" : "#EBF2ED",
              }}
            >
              <Text style={{ color: tab === label ? "#FFF" : "#1B3D2F" }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {tab === "Printer" ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => setReplay(replay + 1)}
              style={{ padding: 10 }}
            >
              <Text style={{ color: "#1B3D2F" }}>Replay print</Text>
            </Pressable>
            <ReceiptPrinter key={replay} booking={tickets[0]} />
          </>
        ) : tab === "Ticket" ? (
          <TravelTicket booking={tickets[0]} width={250} tilt />
        ) : tab === "Collection" ? (
          <TicketHistoryFan
            bookings={tickets}
            onOpen={() => setTab("Printer")}
          />
        ) : (
          <View
            style={{
              width: "90%",
              maxWidth: 380,
              backgroundColor: "#FFF",
              padding: 24,
              borderRadius: 24,
              gap: 18,
            }}
          >
            <Text style={{ fontSize: 20, color: "#1B3D2F" }}>
              {removed ? "Sample removed" : "Remove this sample?"}
            </Text>
            <Text style={{ color: "#67736A" }}>
              This preview changes local sample state only.
            </Text>
            {!removed ? (
              <HoldToConfirm
                label="Hold to delete"
                tone="destructive"
                onConfirm={() => {
                  setRemoved(true);
                  setUndo(true);
                }}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setRemoved(false);
                  setUndo(false);
                }}
              >
                <Text>Reset sample</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
      <UndoBar
        visible={undo}
        message="Sample removed"
        onUndo={() => {
          setRemoved(false);
          setUndo(false);
        }}
        onExpire={() => setUndo(false)}
      />
    </View>
  );
}
