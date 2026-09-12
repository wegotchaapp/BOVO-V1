import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Alert } from "@/lib/alert";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAsyncResource } from "@/hooks/useAsyncResource";
import { useColors } from "@/hooks/useColors";
import {
  EMPTY_SAILOR_NO_TRIPS,
  EMPTY_VOYAGER_NO_POSTS,
  pickLine,
} from "@/constants/voice";
import { CARD_SHADOW, INK_ON_MUTED, STRONG_SHADOW } from "@/constants/colors";
import { formatUsd } from "@/lib/pricing";
import { useAuth } from "@/context/AuthContext";
import { listMyBookings, type Booking } from "@/lib/bookings";
import { getRatingStatus } from "@/lib/ratings";
import { deleteTrip, listMyTrips } from "@/lib/trips";
import { isActivePost } from "@/lib/trip-activity";
import type { Trip } from "@/data/trips";

interface TripItem {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  /** ISO timestamp used for sorting. */
  departureAt: string;
  seats: number;
  price: number;
  status: "upcoming" | "completed" | "cancelled";
  role: "driver" | "rider";
  /**
   * Who the card is about: the Voyager whose seat you booked, or — on an
   * adventure you posted yourself — the car you're taking.
   */
  who: string;
  whoSub: string;
  /** Only a booked seat has a confirmation state; an adventure you posted has none. */
  bookingStatus?: "pending" | "confirmed";
  /** Drivers must record the pre-trip car video before the ride starts. */
  started?: boolean;
  rated?: boolean;
}

function cityShort(c: string): string {
  return c.replace(/, TX$/, "").replace(/, AR$/, "");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function bookingToItem(b: Booking): TripItem {
  const departed = new Date(b.trip.departureAt).getTime() < Date.now();
  const status: TripItem["status"] =
    b.status === "cancelled"
      ? "cancelled"
      : b.status === "completed" || departed
      ? "completed"
      : "upcoming";
  return {
    id: b.id,
    from: cityShort(b.trip.fromCity),
    to: cityShort(b.trip.toCity),
    date: formatDate(b.trip.departureAt),
    time: formatTime(b.trip.departureAt),
    departureAt: b.trip.departureAt,
    seats: b.seats,
    price: b.totalAmount,
    status,
    role: "rider",
    bookingStatus: b.status === "pending" ? "pending" : "confirmed",
    who: b.trip.driverName || "Your Voyager",
    whoSub: b.trip.car,
  };
}

function tripToItem(t: Trip): TripItem {
  const inProgress = t.status === "in_progress";
  // Upcoming only while the post is live. A departed post, or a ride left "in
  // progress" long after it would have arrived, belongs under Past — the old
  // check kept every in-progress ride upcoming forever.
  const status: TripItem["status"] =
    t.status === "cancelled"
      ? "cancelled"
      : isActivePost(t)
      ? "upcoming"
      : "completed";
  return {
    id: t.id,
    from: cityShort(t.fromCity),
    to: cityShort(t.toCity),
    date: formatDate(t.departureAt),
    time: formatTime(t.departureAt),
    departureAt: t.departureAt,
    seats: t.seatsAvailable,
    price: t.pricePerSeat,
    status,
    role: "driver",
    who: t.car,
    whoSub:
      t.seatsAvailable === 0
        ? "Fully booked"
        : `${t.seatsAvailable} seat${t.seatsAvailable === 1 ? "" : "s"} left`,
    started: inProgress || Boolean(t.startedAt),
  };
}

type ActionVariant = "outline" | "gold" | "danger" | "done";

/**
 * A card action. Pills share the row width and are 44pt tall, replacing the
 * 26pt icon chips these used to be. Gold is a fill with dark ink on it, never a
 * text colour.
 */
function ActionBtn({
  label,
  icon,
  variant,
  wide,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  variant: ActionVariant;
  /** Claim the whole row. Two words don't fit beside a sibling at 375pt. */
  wide?: boolean;
  onPress?: () => void;
}) {
  const colors = useColors();
  const skin =
    variant === "gold"
      ? { fill: colors.accent, edge: colors.accent, ink: colors.accentForeground }
      : variant === "danger"
      ? { fill: "transparent", edge: colors.destructive, ink: colors.destructive }
      : variant === "done"
      ? { fill: "#ECFDF5", edge: "#ECFDF5", ink: colors.success }
      : { fill: "transparent", edge: colors.primary, ink: colors.primary };

  const body = (
    <>
      <Feather name={icon} size={14} color={skin.ink} />
      <Text style={[styles.actionText, { color: skin.ink }]} numberOfLines={1}>
        {label}
      </Text>
    </>
  );
  const box = [
    styles.actionBtn,
    { backgroundColor: skin.fill, borderColor: skin.edge },
    wide && styles.actionWide,
  ];

  // "Rated" is a state, not a control, so it renders flat.
  return onPress ? (
    <TouchableOpacity style={box} onPress={onPress} activeOpacity={0.85}>
      {body}
    </TouchableOpacity>
  ) : (
    <View style={box}>{body}</View>
  );
}

export default function TripsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<"upcoming" | "past" | "cancelled">("upcoming");
  /** Whether a finished seat has already been rated, keyed by booking id. */
  const [ratedById, setRatedById] = useState<Map<string, boolean | undefined>>(
    () => new Map(),
  );
  /**
   * Optimistic status changes layered over the server's list, so cancelling
   * moves a post to "Past" immediately. Removed again if the request fails; the
   * next load reconciles with the server either way.
   */
  const [statusOverrides, setStatusOverrides] = useState<
    Map<string, TripItem["status"]>
  >(() => new Map());

  const isDriver = user?.role === "driver";
  // `role` is only ever written during onboarding, so a Voyager who skipped it
  // carries `role: null` and would be shown no way to post again. Having posted
  // an adventure is proof enough.

  const trips = useAsyncResource(
    async () => {
      // Always fetch the rider's bookings; if the user is a driver, also pull
      // their own posted trips. (The list endpoint already filters to active +
      // MVP cities; we further dedupe by driverId on the client.)
      const [bookings, myTrips] = await Promise.all([
        listMyBookings(),
        user ? listMyTrips() : Promise.resolve([] as Trip[]),
      ]);
      const merged: TripItem[] = [
        ...bookings.map(bookingToItem),
        ...myTrips.map(tripToItem),
      ];
      // Upcoming first (earliest departure first), then past (most recent first).
      merged.sort((a, b) => {
        const aUp = a.status === "upcoming";
        const bUp = b.status === "upcoming";
        if (aUp && !bUp) return -1;
        if (!aUp && bUp) return 1;
        const aT = new Date(a.departureAt).getTime();
        const bT = new Date(b.departureAt).getTime();
        return aUp ? aT - bT : bT - aT;
      });
      return merged;
    },
    { deps: [user?.id] },
  );

  // Kept out of the fetch above on purpose: the rating lookup is one request per
  // finished booking, and holding the whole list behind it would slow the first
  // paint for everyone. A failed lookup leaves the Rate action showing, which is
  // the old behaviour.
  useEffect(() => {
    const finished = (trips.data ?? []).filter(
      (i) => i.status === "completed" && i.role === "rider",
    );
    if (finished.length === 0) return;
    let cancelled = false;
    void Promise.all(
      finished.map((i) =>
        getRatingStatus(i.id)
          .then((r) => r.rated)
          .catch(() => undefined),
      ),
    ).then((flags) => {
      if (cancelled) return;
      setRatedById(new Map(finished.map((i, n) => [i.id, flags[n]])));
    });
    return () => {
      cancelled = true;
    };
  }, [trips.data]);

  const items = useMemo(
    () =>
      (trips.data ?? []).map((i) => {
        const rated = ratedById.has(i.id) ? ratedById.get(i.id) : i.rated;
        const status = statusOverrides.get(i.id) ?? i.status;
        return rated === i.rated && status === i.status
          ? i
          : { ...i, rated, status };
      }),
    [trips.data, ratedById, statusOverrides],
  );

  // Returning to the tab refreshes rather than reloads, so the list stays on
  // screen instead of being replaced by a spinner every time. The hook does the
  // first load itself, so the initial focus is skipped.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void trips.refresh();
    }, [trips.refresh]),
  );

  function confirmDelete(item: TripItem) {
    Alert.alert(
      "Cancel this Adventure?",
      `Your post from ${item.from} → ${item.to} on ${item.date} will be removed from search results. Existing booking history is preserved.`,
      [
        { text: "Don't Cancel", style: "cancel" },
        {
          text: "Cancel Adventure",
          style: "destructive",
          onPress: async () => {
            // Optimistic: flip status to cancelled so it moves to "Past"
            // immediately. Restore prior status on failure.
            setStatusOverrides((curr) =>
              new Map(curr).set(item.id, "cancelled"),
            );
            try {
              await deleteTrip(item.id);
            } catch (err: any) {
              // Drop the override so the row falls back to the server's status.
              setStatusOverrides((curr) => {
                const next = new Map(curr);
                next.delete(item.id);
                return next;
              });
              Alert.alert(
                "Couldn't cancel",
                err?.message || "Please try again.",
              );
            }
          },
        },
      ],
    );
  }

  const canPost = isDriver || items.some((i) => i.role === "driver");

  const filtered = items.filter((t) =>
    tab === "upcoming"
      ? t.status === "upcoming"
      : tab === "past"
      ? t.status === "completed"
      : t.status === "cancelled",
  );

  // Voice differs by role: a Voyager is nudged to post, a Sailor to book.
  const emptyVoice = useMemo(
    () =>
      pickLine(
        canPost ? EMPTY_VOYAGER_NO_POSTS : EMPTY_SAILOR_NO_TRIPS,
        user?.id,
      ),
    [canPost, user?.id],
  );

  function renderTrip({ item }: { item: TripItem }) {
    const isUpcoming = item.status === "upcoming";
    const isPost = item.role === "driver";
    // Voyagers must record the mandatory car video before tracking unlocks.
    const needsStartVideo = isPost && !item.started;
    // `tracking/[id]` resolves its id with getBooking, so it only accepts a
    // booking id. A posted adventure's `item.id` is the trip id, so sending a
    // Voyager there returned "Adventure not found" — their in-trip screen is
    // the manifest, and a Voyager has no booking to track.
    const goLive = () =>
      needsStartVideo
        ? router.push({ pathname: "/pre-trip-video" as any, params: { tripId: item.id } })
        : isPost
        ? router.push({ pathname: "/manifest/[tripId]", params: { tripId: item.id } })
        : router.push({ pathname: "/tracking/[id]", params: { id: item.id } });

    const statusConfig = {
      upcoming:
        item.bookingStatus === "pending"
          ? {
              // #D97706 is 2.90:1 on this fill; this holds the amber at 5.78:1.
              bg: "#FEF3E2",
              text: "#7A5A1E",
              label: "Pending",
              icon: "clock" as const,
            }
          : {
              bg: "#EBF2ED",
              text: colors.primary,
              label: item.bookingStatus === "confirmed" ? "Confirmed" : "Upcoming",
              icon: "check-circle" as const,
            },
      completed: {
        bg: colors.muted,
        text: INK_ON_MUTED,
        label: "Completed",
        icon: "clock" as const,
      },
      cancelled: {
        bg: "#FEF0F0",
        text: colors.destructive,
        label: "Cancelled",
        icon: "x-circle" as const,
      },
    }[item.status];

    const actions: React.ReactNode[] = [];
    // One primary action per card, and it matches where goLive actually goes:
    // the video gate first, then the manifest for your own adventure or live
    // tracking for a seat you booked. Odometer logging sits behind the manifest.
    if (isUpcoming) {
      actions.push(
        <ActionBtn
          key="go"
          label={needsStartVideo ? "Start Adventure" : isPost ? "Manifest" : "Track"}
          icon={needsStartVideo ? "video" : isPost ? "clipboard" : "map-pin"}
          variant={needsStartVideo ? "gold" : "outline"}
          wide={needsStartVideo}
          onPress={goLive}
        />,
      );
    }
    if (isUpcoming && isPost) {
      actions.push(
        <ActionBtn
          key="cancel"
          label="Cancel"
          icon="trash-2"
          variant="danger"
          onPress={() => confirmDelete(item)}
        />,
      );
    }
    if (item.status === "completed" && !item.rated && !isPost) {
      actions.push(
        <ActionBtn
          key="rate"
          label="Rate"
          icon="star"
          variant="gold"
          onPress={() => router.push({ pathname: "/rate-trip/[id]", params: { id: item.id } })}
        />,
      );
    }
    if (item.status === "completed" && item.rated) {
      actions.push(<ActionBtn key="rated" label="Rated" icon="check" variant="done" />);
    }

    return (
      <TouchableOpacity
        style={[styles.card, CARD_SHADOW]}
        onPress={() => (isUpcoming ? goLive() : undefined)}
        activeOpacity={isUpcoming ? 0.88 : 1}
      >
        {/* Departure leads the card, and the date keeps its time — they are one
            fact, not two fields. */}
        <View style={styles.cardHead}>
          <Text
            style={[
              styles.when,
              { color: isUpcoming ? colors.foreground : INK_ON_MUTED },
            ]}
          >
            {item.date} · {item.time}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Feather name={statusConfig.icon} size={12} color={statusConfig.text} />
            <Text style={[styles.statusText, { color: statusConfig.text }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.routeRow}>
          <View style={styles.rail}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isUpcoming ? colors.primary : colors.border },
              ]}
            />
            <View style={[styles.railLine, { borderLeftColor: colors.border }]} />
            <View
              style={[
                styles.dot,
                { backgroundColor: isUpcoming ? colors.accent : colors.border },
              ]}
            />
          </View>
          <View style={styles.cities}>
            <Text style={[styles.city, { color: colors.foreground }]}>{item.from}, TX</Text>
            <Text style={[styles.city, { color: colors.foreground }]}>{item.to}, TX</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Who you're travelling with — or, on your own post, what you're
            driving. Both come straight off the payload. */}
        <View style={styles.whoRow}>
          <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
            {isPost ? (
              <Feather name="truck" size={17} color={colors.primary} />
            ) : (
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {(item.who.trim()[0] || "?").toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.whoText}>
            <Text style={[styles.whoName, { color: colors.foreground }]} numberOfLines={1}>
              {item.who}
            </Text>
            <Text
              style={[styles.whoSub, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {item.whoSub}
            </Text>
          </View>
          <View style={styles.priceBlock}>
            <Text style={[styles.price, { color: colors.foreground }]}>
              {formatUsd(item.price)}
            </Text>
            <Text style={[styles.priceLabel, { color: colors.mutedForeground }]}>
              {isPost ? "per seat" : `${item.seats} seat${item.seats === 1 ? "" : "s"}`}
            </Text>
          </View>
        </View>

        {actions.length > 0 && <View style={styles.actionRow}>{actions}</View>}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16) }]}>
        <Text style={[styles.heading, { color: colors.primary }]}>My Adventures</Text>
        {/* A white track with a hairline edge, not a muted fill: the inactive
            label measured 4.32:1 on `muted` and clears 4.96:1 on white. */}
        <View style={[styles.tabRow, { borderColor: colors.border }]}>
          {(["upcoming", "past", "cancelled"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && { backgroundColor: colors.primary }]}
              onPress={() => setTab(t)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === t ? "#fff" : colors.mutedForeground },
                  tab === t && { fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {t === "upcoming" ? "Upcoming" : t === "past" ? "Past" : "Cancelled"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {trips.phase === "loading" ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderTrip}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (canPost ? 184 : 110) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={trips.refreshing}
              onRefresh={trips.refresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="map" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {trips.phase === "failed"
                  ? "Couldn't load your adventures"
                  : emptyVoice.title}
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                {trips.phase === "failed"
                  ? (trips.error?.message ?? emptyVoice.body)
                  : emptyVoice.body}
              </Text>
              <TouchableOpacity
                style={[styles.findBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push(canPost ? ("/post-trip" as any) : "/(tabs)")}
              >
                <Text style={styles.findBtnText}>
                  {canPost ? "Post an Adventure" : "Find an Adventure"}
                </Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {canPost && (
        <View
          style={[
            styles.postWrap,
            { bottom: insets.bottom + (Platform.OS === "web" ? 100 : 84) },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={[styles.postBtn, { backgroundColor: colors.primary }, STRONG_SHADOW]}
            onPress={() => router.push("/post-trip" as any)}
            activeOpacity={0.9}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={styles.postBtnText}>Post Adventure</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 22, paddingBottom: 16, gap: 14 },
  heading: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },

  tabRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  list: { paddingHorizontal: 22, paddingTop: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
    gap: 14,
  },

  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  when: { fontSize: 15, fontFamily: "Inter_600SemiBold", flexShrink: 1 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  routeRow: { flexDirection: "row", gap: 12 },
  rail: { width: 12, alignItems: "center", paddingVertical: 6 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  railLine: { flex: 1, borderLeftWidth: 2, borderStyle: "dashed", marginVertical: 4 },
  cities: { flex: 1, gap: 16 },
  city: { fontSize: 17, fontFamily: "Inter_600SemiBold", letterSpacing: -0.2 },

  divider: { height: 1 },

  whoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  whoText: { flex: 1, gap: 2 },
  whoName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  whoSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  priceBlock: { alignItems: "flex-end", gap: 2 },
  price: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  priceLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },

  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: {
    flexGrow: 1,
    flexBasis: 120,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionWide: { flexBasis: "100%" },
  actionText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },

  postWrap: { position: "absolute", left: 22, right: 22 },
  postBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 999,
  },
  postBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },

  empty: { alignItems: "center", paddingTop: 60, gap: 14 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 24 },
  findBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 28 },
  findBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
