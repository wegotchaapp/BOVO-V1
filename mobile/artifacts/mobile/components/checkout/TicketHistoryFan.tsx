import React, { useEffect, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { Booking } from "@/lib/bookings";
import { TravelTicket } from "./TravelTicket";
import { fanPosition } from "./motion";
import { useReducedMotion } from "./useReducedMotion";

function FanCard({
  booking,
  index,
  count,
  width,
  selected,
  pileIndex,
  hovered,
  onSelect,
  onHover,
}: {
  booking: Booking;
  index: number;
  count: number;
  width: number;
  selected: boolean;
  pileIndex: number;
  hovered: number | null;
  onSelect: () => void;
  onHover: (index: number | null) => void;
}) {
  const reduced = useReducedMotion();
  const cardWidth = Math.min(122, width * 0.34);
  const inPile = pileIndex >= 0;
  const pileRotation =
    (Array.from(booking.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) %
      15) -
    7;
  const position = fanPosition(index, count, width, cardWidth);
  const gesture = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-30, 30])
    .onEnd((event) => {
      if (event.translationY < -80 || event.velocityY < -600)
        runOnJS(onSelect)();
    });
  const x = useSharedValue(position.x),
    y = useSharedValue(position.y),
    rotation = useSharedValue(position.rotation),
    scale = useSharedValue(1);
  useEffect(() => {
    const animate = (value: number) =>
      reduced !== false
        ? withTiming(value, { duration: 0 })
        : withSpring(value, { damping: 30, mass: 0.9, stiffness: 340 });
    const hover = !inPile && hovered === index;
    const neighbor =
      hovered !== null && !hover
        ? (Math.sign(index - hovered) * 24) /
          Math.max(1, Math.abs(index - hovered))
        : 0;
    x.value = animate(inPile ? pileRotation * 1.3 : position.x + neighbor);
    y.value = animate(
      inPile ? -218 - pileIndex * 2 : position.y - (hover ? 54 : 0),
    );
    rotation.value = animate(
      inPile ? pileRotation : position.rotation * (hover ? 0.3 : 1),
    );
    scale.value = animate(inPile ? 1.55 : hover ? 1.06 : 1);
  }, [
    inPile,
    pileIndex,
    pileRotation,
    hovered,
    index,
    reduced,
    position.x,
    position.y,
    position.rotation,
    x,
    y,
    rotation,
    scale,
  ]);
  const style = useAnimatedStyle(() => ({
    zIndex: inPile ? 100 + pileIndex : hovered === index ? 50 : index,
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          {
            position: "absolute",
            bottom: -46,
            left: (width - cardWidth) / 2,
            boxShadow: "0 7px 18px rgba(15,35,24,.22)",
          },
          style,
        ]}
      >
        <Pressable
          onPress={onSelect}
          onHoverIn={() => onHover(inPile ? null : index)}
          onHoverOut={() => onHover(null)}
          accessibilityRole="button"
          accessibilityLabel={`Select ticket from ${booking.trip.fromCity} to ${booking.trip.toCity}`}
          accessibilityState={{ selected }}
        >
          <View
            pointerEvents="none"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <TravelTicket booking={booking} width={cardWidth} />
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}
export function TicketHistoryFan({
  bookings,
  onOpen,
}: {
  bookings: Booking[];
  onOpen: (booking: Booking) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(520, screenWidth - 40);
  const [playedIds, setPlayedIds] = useState<string[]>([]);
  const selectedId = playedIds[playedIds.length - 1];
  const remaining = bookings.filter(
    (booking) => !playedIds.includes(booking.id),
  );
  const [hovered, setHovered] = useState<number | null>(null);
  const selected = bookings.find((booking) => booking.id === selectedId);
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width, height: 520, overflow: "hidden" }}>
        {bookings.map((booking) => (
          <FanCard
            key={booking.id}
            booking={booking}
            index={Math.max(
              0,
              remaining.findIndex((item) => item.id === booking.id),
            )}
            count={remaining.length}
            pileIndex={playedIds.indexOf(booking.id)}
            width={width}
            hovered={hovered}
            selected={booking.id === selectedId}
            onHover={setHovered}
            onSelect={() =>
              setPlayedIds((ids) =>
                ids.includes(booking.id)
                  ? ids.filter((id) => id !== booking.id)
                  : [...ids, booking.id],
              )
            }
          />
        ))}
      </View>
      <View
        style={{ minHeight: 116, alignItems: "center", padding: 16, gap: 12 }}
      >
        <Text style={{ color: "#67736A", fontSize: 12 }}>
          {selected
            ? `${selected.trip.fromCity} → ${selected.trip.toCity}`
            : "Tap a ticket or flick it upward to take a closer look."}
        </Text>
        {selected ? (
          <View style={{ flexDirection: "row", gap: 24 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPlayedIds([])}
              style={{ padding: 12 }}
            >
              <Text style={{ color: "#1B3D2F" }}>Return to fan</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpen(selected)}
              style={{
                padding: 12,
                backgroundColor: "#1B3D2F",
                borderRadius: 24,
              }}
            >
              <Text style={{ color: "#FFF" }}>Open booking</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}
