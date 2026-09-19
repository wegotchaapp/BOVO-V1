import { BoardingQrSvg } from "./BoardingQrSvg";
import React, { useId } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useReducedMotion } from "./useReducedMotion";
import { Pressable, View } from "react-native";
import Svg, {
  Path,
  Rect,
  Circle,
  Text as SvgText,
  Line,
  G,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import type { Booking } from "@/lib/bookings";

export function TravelTicket({
  booking,
  width = 220,
  tilt = false,
  qrPayload,
}: {
  booking: Booking;
  width?: number;
  tilt?: boolean;
  qrPayload?: string | null;
}) {
  const gradientId = `ticket${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const reduced = useReducedMotion();
  const rotation = useSharedValue(0);
  const tiltStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1100 },
      { rotateY: `${rotation.value}deg` },
      { rotateZ: `${rotation.value * 0.15}deg` },
    ],
  }));
  const date = new Date(booking.trip.departureAt);
  const city = (value: string) => value.split(",")[0];
  const from = city(booking.trip.fromCity),
    to = city(booking.trip.toCity);
  const reference = booking.id.slice(-10).toUpperCase();
  const description = `${from} to ${to}. ${date.toLocaleString()}. ${booking.seats} seats. ${booking.status}. Booking total $${booking.totalAmount.toFixed(2)}. Reference ${reference}.`;
  return (
    <Animated.View style={tiltStyle}>
      <Pressable
        accessible={false}
        onHoverIn={() => {
          if (tilt && reduced === false)
            rotation.value = withTiming(6, { duration: 220 });
        }}
        onHoverOut={() => {
          rotation.value = withTiming(0, { duration: 220 });
        }}
      >
        <View
          accessible
          accessibilityLabel={description}
          style={{ width, height: width * 2.4 }}
        >
          <Svg
            width={width}
            height={width * 2.4}
            viewBox="0 0 250 600"
            aria-hidden
          >
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#294F3D" />
                <Stop offset="1" stopColor="#112D23" />
              </LinearGradient>
            </Defs>
            <Path
              d="M3 0 H247 Q250 0 250 3 V443 L237 456 L250 469 V597 Q250 600 247 600 H3 Q0 600 0 597 V469 L13 456 L0 443 V3 Q0 0 3 0Z"
              fill={`url(#${gradientId})`}
            />
            <SvgText
              fontFamily="Inter_500Medium"
              x="22"
              y="32"
              fill="#E9D7AE"
              fontSize="10"
              letterSpacing="3"
              fontWeight="700"
            >
              BOVOGO / ADVENTURE
            </SvgText>
            <G transform="translate(0 8)">
            {Array.from({ length: 15 }, (_, row) =>
              Array.from({ length: 7 }, (_, column) => {
                const route =
                  Math.abs(column - (3 + Math.sin(row * 0.48) * 2)) < 1.5;
                const horizon =
                  row > 9 &&
                  column > 2 &&
                  column < 17 &&
                  (column + row) % 3 !== 0;
                return (
                  <Circle
                    key={`${row}-${column}`}
                    cx={15 + column * 10}
                    cy={65 + row * 10}
                    r={route ? 2.9 : 1.5}
                    fill={route ? "#D9AF6A" : "#EBF2ED"}
                    opacity={route ? 0.95 : horizon ? 0.32 : 0.09}
                  />
                );
              }),
            )}
            </G>
            {qrPayload ? (
              <BoardingQrSvg payload={qrPayload} x={94} y={60} size={136} />
            ) : (
              <SvgText x="162" y="120" fill="#B2C5B7" fontSize="9" textAnchor="middle">
                {booking.status === "completed" ? "ADVENTURE COMPLETE" : "BOARDING PASS"}
              </SvgText>
            )}
            <SvgText x="162" y="216" fill="#D9AF6A" fontSize="8" letterSpacing="1" textAnchor="middle">
              {qrPayload ? "SCAN TO BOARD" : "YOUR NEXT ADVENTURE"}
            </SvgText>
            <SvgText
              fontFamily="Inter_500Medium"
              x="22"
              y="244"
              fill="#B2C5B7"
              fontSize="9"
              letterSpacing="2"
            >
              YOUR NEXT CHAPTER
            </SvgText>
            <SvgText
              fontFamily="Inter_500Medium"
              x="20"
              y="284"
              fill="#F8F7F3"
              fontSize={from.length > 13 ? 23 : 30}
              fontWeight="700"
            >
              {from.length > 19 ? from.slice(0, 18) + "…" : from}
            </SvgText>
            <SvgText
              fontFamily="Inter_500Medium"
              x="22"
              y="313"
              fill="#D9AF6A"
              fontSize="21"
            >
              ↓
            </SvgText>
            <SvgText
              fontFamily="Inter_500Medium"
              x="20"
              y="350"
              fill="#F8F7F3"
              fontSize={to.length > 13 ? 23 : 30}
              fontWeight="700"
            >
              {to.length > 19 ? to.slice(0, 18) + "…" : to}
            </SvgText>
            <SvgText
              fontFamily="Inter_500Medium"
              x="22"
              y="377"
              fill="#B2C5B7"
              fontSize="11"
            >
              A little further. Together.
            </SvgText>
            <SvgText
              fontFamily="Inter_500Medium"
              x="22"
              y="410"
              fill="#D9AF6A"
              fontSize="8"
              letterSpacing="1.5"
            >
              DEPARTURE
            </SvgText>
            <SvgText
              fontFamily="Inter_500Medium"
              x="22"
              y="432"
              fill="#F8F7F3"
              fontSize="12"
            >
              {date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              ·{" "}
              {date.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </SvgText>
            <Line
              x1="17"
              y1="456"
              x2="233"
              y2="456"
              stroke="#98AE9B"
              strokeOpacity=".5"
              strokeDasharray="3 5"
            />
            <SvgText
              fontFamily="Inter_500Medium"
              x="22"
              y="484"
              fill="#B2C5B7"
              fontSize="8"
              letterSpacing="1.5"
            >
              {booking.seats} SEAT{booking.seats === 1 ? "" : "S"} /{" "}
              {booking.status.toUpperCase()}
            </SvgText>
            <SvgText
              fontFamily="Inter_500Medium"
              x="22"
              y="507"
              fill="#F8F7F3"
              fontSize="11"
            >
              {booking.trip.driverName.slice(0, 29)}
            </SvgText>
            <SvgText x="22" y="540" fill="#D9AF6A" fontSize="10" fontFamily="Inter_500Medium">
              BOOKING TOTAL  ${booking.totalAmount.toFixed(2)}
            </SvgText>
            <SvgText
              fontFamily="Inter_500Medium"
              x="125"
              y="577"
              textAnchor="middle"
              fill="#B2C5B7"
              fontSize="9"
              letterSpacing="2"
            >
              {reference}
            </SvgText>
          </Svg>
        </View>
      </Pressable>
    </Animated.View>
  );
}
