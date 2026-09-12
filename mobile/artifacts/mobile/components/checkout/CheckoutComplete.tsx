import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Booking } from "@/lib/bookings";
import { ReceiptPrinter } from "./ReceiptPrinter";
export function CheckoutComplete({ booking }: { booking: Booking }) {
  const router = useRouter();
  const printable =
    booking.status === "confirmed" || booking.status === "completed";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8F7F3" }}>
      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          paddingTop: 24,
          paddingBottom: 32,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 24, alignItems: "center", gap: 8 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 26,
              color: "#1B3D2F",
            }}
          >
            {printable ? "You’re going places." : "Your booking"}
          </Text>
          <Text style={{ fontSize: 13, color: "#67736A", textAlign: "center" }}>
            {printable
              ? "Your Adventure is booked. Let’s make it a good one."
              : `Booking status: ${booking.status}`}
          </Text>
        </View>
        {printable ? (
          <ReceiptPrinter key={booking.id} booking={booking} />
        ) : (
          <Text style={{ color: "#1B3D2F" }}>
            {booking.trip.fromCity} → {booking.trip.toCity}
          </Text>
        )}
        <View
          style={{
            width: "100%",
            maxWidth: 408,
            paddingHorizontal: 24,
            gap: 12,
          }}
        >
          {booking.groupId ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.replace({
                  pathname: "/group/[id]",
                  params: { id: booking.groupId! },
                })
              }
              style={{
                padding: 18,
                borderRadius: 28,
                alignItems: "center",
                backgroundColor: "#1B3D2F",
              }}
            >
              <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold" }}>
                Open Adventure group
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/(tabs)/trips")}
            style={{
              padding: 18,
              borderRadius: 28,
              alignItems: "center",
              backgroundColor: booking.groupId ? "#EBF2ED" : "#1B3D2F",
            }}
          >
            <Text
              style={{
                color: booking.groupId ? "#1B3D2F" : "#FFF",
                fontFamily: "Inter_600SemiBold",
              }}
            >
              View My Adventures
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/(tabs)")}
            style={{ padding: 14, alignItems: "center" }}
          >
            <Text style={{ color: "#67736A" }}>Back to Home</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
