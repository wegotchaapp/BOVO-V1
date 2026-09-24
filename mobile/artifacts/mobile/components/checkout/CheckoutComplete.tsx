import { useTicketBoardingPass } from "./useTicketBoardingPass";
import { BoardingQrSvg } from "./BoardingQrSvg";
import Svg from "react-native-svg";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Booking } from "@/lib/bookings";
import { ReceiptPrinter } from "./ReceiptPrinter";
export function CheckoutComplete({ booking }: { booking: Booking }) {
  const router = useRouter();
  const [printerHeight, setPrinterHeight] = useState(0);
  const [qrOpen, setQrOpen] = useState(false);
  const pass = useTicketBoardingPass(booking);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const enlargedQrSize = Math.max(
    120,
    Math.min(320, windowWidth - 64, windowHeight - 220),
  );
  const printable =
    booking.status === "confirmed" || booking.status === "completed";
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8F7F3" }}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          paddingTop: 10,
          paddingBottom: 8,
          gap: 6,
        }}
      >
        <View style={{ paddingHorizontal: 24, alignItems: "center", gap: 8 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 23,
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
        <View
          style={{
            flex: 1,
            width: "100%",
            minHeight: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
          onLayout={(event) =>
            setPrinterHeight(event.nativeEvent.layout.height)
          }
        >
          {printable && printerHeight > 0 ? (
            <ReceiptPrinter
              key={booking.id}
              booking={booking}
              maxHeight={printerHeight}
              qrPayload={pass.payload}
            />
          ) : !printable ? (
            <Text style={{ color: "#1B3D2F" }}>
              {booking.trip.fromCity} → {booking.trip.toCity}
            </Text>
          ) : null}
        </View>
        {booking.status === "confirmed" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              pass.payload ? setQrOpen(true) : void pass.reload()
            }
            style={{ paddingVertical: 6, paddingHorizontal: 16 }}
          >
            <Text style={{ color: "#1B3D2F", fontSize: 12 }}>
              {pass.payload
                ? "Enlarge boarding QR"
                : pass.phase === "failed"
                  ? "Boarding QR unavailable · Tap to retry"
                  : "Loading boarding QR…"}
            </Text>
          </Pressable>
        ) : null}
        <View
          style={{
            width: "100%",
            maxWidth: 408,
            paddingHorizontal: 24,
            gap: 6,
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
                padding: 12,
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
              padding: 12,
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
            style={{ padding: 8, alignItems: "center" }}
          >
            <Text style={{ color: "#67736A" }}>Back to Home</Text>
          </Pressable>
        </View>
      </View>
      <Modal
        visible={qrOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setQrOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(8,20,12,.75)",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              padding: 20,
              borderRadius: 24,
              backgroundColor: "#FFF",
              alignItems: "center",
              gap: 18,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{ fontSize: 20, color: "#1B3D2F" }}
            >
              Ready to board
            </Text>
            <Text style={{ color: "#67736A", fontSize: 12 }}>
              Show this QR to your Voyager.
            </Text>
            {pass.payload ? (
              <Svg width={enlargedQrSize} height={enlargedQrSize}>
                <BoardingQrSvg
                  payload={pass.payload}
                  x={0}
                  y={0}
                  size={enlargedQrSize}
                />
              </Svg>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => setQrOpen(false)}
              style={{ padding: 14 }}
            >
              <Text style={{ color: "#1B3D2F" }}>Back to ticket</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
