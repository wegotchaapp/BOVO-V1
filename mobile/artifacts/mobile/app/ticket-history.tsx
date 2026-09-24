import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { TicketHistoryFan } from "@/components/checkout/TicketHistoryFan";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { useColors } from "@/hooks/useColors";
import { listMyBookings } from "@/lib/bookings";
export default function TicketHistory() {
  const router = useRouter(),
    colors = useColors();
  const resource = useAsyncResource(listMyBookings, {
    isEmpty: (data) => data.length === 0,
  });
  const [page, setPage] = useState(0);
  const bookings = [...(resource.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const pages = Math.max(1, Math.ceil(bookings.length / 5));
  const currentPage = Math.min(page, pages - 1);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ alignItems: "center", paddingVertical: 24 }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 520,
            paddingHorizontal: 24,
            gap: 14,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={{ paddingVertical: 12 }}
          >
            <Text style={{ color: colors.primary }}>← My Adventures</Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            style={{
              fontSize: 30,
              fontFamily: "Inter_600SemiBold",
              color: colors.primary,
            }}
          >
            Your ticket collection
          </Text>
          <Text style={{ color: colors.mutedForeground }}>
            Places you’ve been. Chapters still to come.
          </Text>
        </View>
        {resource.phase === "failed" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void resource.reload()}
            style={{ padding: 30 }}
          >
            <Text style={{ color: colors.destructive }}>
              Couldn’t load your tickets. Tap to retry.
            </Text>
          </Pressable>
        ) : !resource.data ? (
          <ActivityIndicator style={{ padding: 40 }} color={colors.primary} />
        ) : bookings.length === 0 ? (
          <Text style={{ padding: 40, color: colors.mutedForeground }}>
            Your bookings will appear here.
          </Text>
        ) : (
          <TicketHistoryFan
            key={currentPage}
            bookings={bookings.slice(currentPage * 5, currentPage * 5 + 5)}
            onOpen={(booking) =>
              router.push({
                pathname: "/booking-confirmed",
                params: { id: booking.id },
              })
            }
          />
        )}
        {pages > 1 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 24 }}>
            <Pressable
              accessibilityRole="button"
              disabled={currentPage === 0}
              onPress={() => setPage(currentPage - 1)}
              style={{ padding: 12, opacity: currentPage === 0 ? 0.35 : 1 }}
            >
              <Text>Previous</Text>
            </Pressable>
            <Text>
              {currentPage + 1} / {pages}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={currentPage === pages - 1}
              onPress={() => setPage(currentPage + 1)}
              style={{
                padding: 12,
                opacity: currentPage === pages - 1 ? 0.35 : 1,
              }}
            >
              <Text>Next</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
