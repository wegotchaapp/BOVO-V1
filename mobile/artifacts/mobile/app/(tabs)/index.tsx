import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WeatherBackground } from "@/components/weather/WeatherBackground";
import { DestinationWeatherInsight } from "@/components/weather/DestinationWeatherInsight";

const WEATHER_HEIGHT = Dimensions.get("window").height * 0.38;

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useUnread } from "@/context/UnreadContext";
import {
  ALL_CITY_OPTIONS,
  MVP_CITIES,
  isMvpCity,
  type CityOption,
} from "@/data/cities";
import {
  formatTimeAgo,
  formatTripDate,
  formatTripTime,
  type Trip,
} from "@/data/trips";
import { listTrips } from "@/lib/trips";
import { CARD_SHADOW } from "@/constants/colors";


// ─── Shared sub-components ────────────────────────────────────────────────────

function DriverAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const colors = useColors();
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.primary, fontSize: size * 0.34, fontFamily: "Inter_700Bold" }}>{initials}</Text>
    </View>
  );
}

function PostCard({ post, onPress, hasNewReplies }: { post: Trip; onPress: () => void; hasNewReplies?: boolean }) {
  const colors = useColors();
  return (
    <TouchableOpacity style={[styles.postCard, CARD_SHADOW]} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.postHeader}>
        <DriverAvatar name={post.driver.name} />
        <View style={styles.postDriverInfo}>
          <View style={styles.postDriverNameRow}>
            <Text style={[styles.postDriverName, { color: colors.foreground }]}>{post.driver.name}</Text>
            {post.driver.isTopDriver && (
              <View style={[styles.topBadge, { backgroundColor: "#FEF3E2" }]}>
                <Feather name="award" size={9} color="#C4954A" />
                <Text style={[styles.topBadgeText, { color: "#C4954A" }]}>Top Voyager</Text>
              </View>
            )}
          </View>
          <View style={styles.postRatingRow}>
            <Feather name="star" size={10} color="#C4954A" />
            <Text style={[styles.postRatingText, { color: colors.mutedForeground }]}>
              {post.driver.rating.toFixed(1)} · {post.driver.trips} trip{post.driver.trips !== 1 ? "s" : ""}
            </Text>
            <Text style={[styles.postDot, { color: colors.border }]}>·</Text>
            <Text style={[styles.postRatingText, { color: colors.mutedForeground }]}>{formatTimeAgo(post.createdAt)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.postRouteRow}>
        <View style={styles.postRouteItem}>
          <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.postCityText, { color: colors.foreground }]}>{post.fromCity}</Text>
        </View>
        <View style={[styles.postRouteLine, { backgroundColor: colors.border }]} />
        <Feather name="arrow-right" size={14} color={colors.mutedForeground} style={{ marginHorizontal: 4 }} />
        <View style={[styles.postRouteLine, { backgroundColor: colors.border }]} />
        <View style={styles.postRouteItem}>
          <View style={[styles.routeDot, { backgroundColor: colors.accent }]} />
          <Text style={[styles.postCityText, { color: colors.foreground }]}>{post.toCity}</Text>
        </View>
      </View>

      {post.note ? (
        <Text style={[styles.postNote, { color: colors.mutedForeground }]} numberOfLines={2}>
          {post.note}
        </Text>
      ) : null}

      <View style={styles.postFooter}>
        <View style={[styles.postMetaChip, { backgroundColor: colors.muted }]}>
          <Feather name="calendar" size={11} color={colors.mutedForeground} />
          <Text style={[styles.postMetaText, { color: colors.foreground }]}>{formatTripDate(post.departureAt)}</Text>
        </View>
        <View style={[styles.postMetaChip, { backgroundColor: colors.muted }]}>
          <Feather name="clock" size={11} color={colors.mutedForeground} />
          <Text style={[styles.postMetaText, { color: colors.foreground }]}>{formatTripTime(post.departureAt)}</Text>
        </View>
        <View style={[styles.postMetaChip, { backgroundColor: colors.muted }]}>
          <Feather name="users" size={11} color={colors.mutedForeground} />
          <Text style={[styles.postMetaText, { color: colors.foreground }]}>
            {post.seatsAvailable} seat{post.seatsAvailable !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={[styles.postMetaChip, { backgroundColor: colors.muted }]}>
          <Feather name="briefcase" size={11} color={colors.mutedForeground} />
          <Text style={[styles.postMetaText, { color: colors.foreground }]}>
            {post.luggageSpace} bag{post.luggageSpace !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={[styles.postMetaChip, { backgroundColor: "#F0FAF4" }]}>
          <Text style={[styles.postPrice, { color: colors.primary }]}>${post.pricePerSeat}/seat</Text>
        </View>
        <View style={styles.postRepliesRow}>
          <Feather name="message-circle" size={13} color={hasNewReplies ? colors.primary : colors.mutedForeground} />
          <Text style={[styles.postRepliesCount, { color: hasNewReplies ? colors.primary : colors.mutedForeground }]}>{post.replyCount}</Text>
          {hasNewReplies && (
            <View style={[styles.newDot, { backgroundColor: colors.accent }]} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Rider view ───────────────────────────────────────────────────────────────

function RiderView({
  from, to, setFrom, setTo,
  dateLabel, onDatePress,
  openPicker, swapCities, search,
  router, colors,
  posts, loading, error,
  tripUnreads, markTripRead,
}: any) {
  return (
    <>
      <View style={[styles.card, CARD_SHADOW]}>
        <View style={styles.routeRow}>
          <View style={styles.routeLeft}>
            <View style={styles.stopRow}>
              <View style={[styles.stopDot, { backgroundColor: colors.primary }]} />
              <View style={styles.stopContent}>
                <Text style={[styles.stopLabel, { color: colors.mutedForeground }]}>From</Text>
                <TouchableOpacity onPress={() => openPicker("from")} activeOpacity={0.7}>
                  <Text style={[styles.cityText, { color: colors.foreground }]}>{from}</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.dottedLine, { borderLeftColor: colors.border }]} />
            <View style={styles.stopRow}>
              <View style={[styles.stopDot, { backgroundColor: colors.accent }]} />
              <View style={styles.stopContent}>
                <Text style={[styles.stopLabel, { color: colors.mutedForeground }]}>To</Text>
                <TouchableOpacity onPress={() => openPicker("to")} activeOpacity={0.7}>
                  <Text style={[styles.cityText, { color: colors.foreground }]}>{to}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <TouchableOpacity style={[styles.swapBtn, { backgroundColor: colors.secondary }]} onPress={swapCities} activeOpacity={0.75}>
            <Feather name="repeat" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity style={styles.metaRow} onPress={onDatePress} activeOpacity={0.7}>
          <Feather name="calendar" size={15} color={colors.primary} />
          <Text style={[styles.metaText, { color: colors.foreground }]}>{dateLabel}</Text>
          <Feather name="chevron-down" size={14} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.searchBtn, { backgroundColor: colors.primary }]} onPress={search} activeOpacity={0.88}>
        <Feather name="search" size={18} color="#fff" />
        <Text style={styles.searchBtnText}>Search Adventures</Text>
      </TouchableOpacity>

      <View style={[styles.mvpNotice, { backgroundColor: colors.secondary }]}>
        <Feather name="info" size={14} color={colors.primary} />
        <Text style={[styles.mvpNoticeText, { color: colors.primary }]}>
          We're launching with the Austin ↔ Houston corridor. Dallas and Bentonville are coming soon.
        </Text>
      </View>

      <View style={styles.postsSectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 2 }]}>Voyager Posts</Text>
          <Text style={[styles.postsSub, { color: colors.mutedForeground }]}>Voyagers announcing their adventures — reply to join</Text>
        </View>
        <View style={[styles.liveChip, { backgroundColor: "#F0FAF4", borderColor: "#A8D5B5" }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.liveText, { color: colors.success }]}>Live</Text>
        </View>
      </View>

      {loading ? (
        <View style={[styles.feedState, { backgroundColor: colors.muted }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={[styles.feedState, { backgroundColor: colors.muted }]}>
          <Feather name="alert-circle" size={18} color={colors.mutedForeground} />
          <Text style={[styles.feedStateText, { color: colors.mutedForeground }]}>{error}</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={[styles.feedState, { backgroundColor: colors.muted }]}>
          <Feather name="inbox" size={20} color={colors.mutedForeground} />
          <Text style={[styles.feedStateText, { color: colors.mutedForeground }]}>
            No driver posts yet. Pull down to refresh, or check back soon.
          </Text>
        </View>
      ) : (
        posts.map((post: Trip) => (
          <PostCard
            key={post.id}
            post={post}
            hasNewReplies={!!tripUnreads[post.id]}
            onPress={() => {
              markTripRead(post.id);
              router.push({ pathname: "/post/[id]", params: { id: post.id } });
            }}
          />
        ))
      )}
    </>
  );
}

// ─── Driver view ──────────────────────────────────────────────────────────────

function DriverView({ router, colors, user, posts, loading, tripUnreads, markTripRead }: any) {
  const myPosts: Trip[] = useMemo(
    () => posts.filter((t: Trip) => user && t.driver.id === user.id),
    [posts, user],
  );
  const tripsThisMonth = useMemo(() => {
    const now = new Date();
    return myPosts.filter((t) => {
      const d = new Date(t.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [myPosts]);
  const rating = typeof user?.rating === "number" ? user.rating : 0;

  const quickActions = [
    { icon: "truck", label: "My Vehicle", route: "/vehicle" },
    { icon: "dollar-sign", label: "Savings", route: "/earnings" },
    { icon: "map", label: "My Adventures", route: "/(tabs)/trips" },
    { icon: "shield", label: "Safety", route: "/safety" },
  ];

  return (
    <>
      <View style={[styles.driverStatsCard, CARD_SHADOW]}>
        <View style={styles.driverStatItem}>
          <Text style={[styles.driverStatNum, { color: colors.primary }]}>{myPosts.length}</Text>
          <Text style={[styles.driverStatLabel, { color: colors.mutedForeground }]}>Active posts</Text>
        </View>
        <View style={[styles.driverStatSep, { backgroundColor: colors.border }]} />
        <View style={styles.driverStatItem}>
          <Text style={[styles.driverStatNum, { color: colors.foreground }]}>{tripsThisMonth}</Text>
          <Text style={[styles.driverStatLabel, { color: colors.mutedForeground }]}>Posted this month</Text>
        </View>
        <View style={[styles.driverStatSep, { backgroundColor: colors.border }]} />
        <View style={styles.driverStatItem}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={[styles.driverStatNum, { color: colors.foreground }]}>
              {rating > 0 ? rating.toFixed(1) : "—"}
            </Text>
            <Feather name="star" size={14} color="#C4954A" />
          </View>
          <Text style={[styles.driverStatLabel, { color: colors.mutedForeground }]}>Driver rating</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.postTripCta, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/post-trip" as any)}
        activeOpacity={0.88}
      >
        <View style={[styles.postTripCtaIcon, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
          <Feather name="send" size={20} color="#fff" />
        </View>
        <View style={styles.postTripCtaText}>
          <Text style={styles.postTripCtaTitle}>Post a New Adventure</Text>
          <Text style={styles.postTripCtaSub}>Announce your drive · IRS rate auto-calculated</Text>
        </View>
        <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>

      <View style={styles.quickActionsGrid}>
        {quickActions.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={[styles.quickActionCard, CARD_SHADOW]}
            onPress={() => router.push(a.route as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.secondary }]}>
              <Feather name={a.icon as any} size={20} color={colors.primary} />
            </View>
            <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.postsSectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 2 }]}>Your Active Posts</Text>
          <Text style={[styles.postsSub, { color: colors.mutedForeground }]}>Sailors can see and reply to these</Text>
        </View>
        <View style={[styles.liveChip, { backgroundColor: "#F0FAF4", borderColor: "#A8D5B5" }]}>
          <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.liveText, { color: colors.success }]}>Live</Text>
        </View>
      </View>

      {loading ? (
        <View style={[styles.feedState, { backgroundColor: colors.muted }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : myPosts.length === 0 ? (
        <View style={[styles.feedState, { backgroundColor: colors.muted }]}>
          <Feather name="inbox" size={22} color={colors.mutedForeground} />
          <Text style={[styles.feedStateText, { color: colors.mutedForeground }]}>
            No active posts — post a trip above
          </Text>
        </View>
      ) : (
        myPosts.map((post) => (
          <View key={post.id} style={[styles.driverPostCard, CARD_SHADOW]}>
            <View style={styles.driverPostTop}>
              <View style={styles.driverPostRoute}>
                <View style={[styles.routeDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.driverPostCity, { color: colors.foreground }]}>{post.fromCity}</Text>
                <Feather name="arrow-right" size={12} color={colors.mutedForeground} />
                <View style={[styles.routeDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.driverPostCity, { color: colors.foreground }]}>{post.toCity}</Text>
              </View>
              <View style={[styles.driverPostReplies, { backgroundColor: !!tripUnreads[post.id] ? "#FEF3E2" : colors.muted }]}>
                <Feather name="message-circle" size={12} color={!!tripUnreads[post.id] ? colors.accent : colors.primary} />
                <Text style={[styles.driverPostRepliesCount, { color: !!tripUnreads[post.id] ? colors.accent : colors.primary }]}>{post.replyCount}</Text>
                {!!tripUnreads[post.id] && (
                  <View style={[styles.newDot, { backgroundColor: colors.accent }]} />
                )}
              </View>
            </View>
            <View style={styles.driverPostMeta}>
              <Text style={[styles.driverPostDate, { color: colors.mutedForeground }]}>
                {formatTripDate(post.departureAt)} · {formatTripTime(post.departureAt)}
              </Text>
              <View style={[styles.driverPostSeats, { backgroundColor: "#F0FAF4" }]}>
                <Feather name="users" size={11} color={colors.primary} />
                <Text style={[styles.driverPostSeatsText, { color: colors.primary }]}>
                  {post.seatsAvailable} seats · ${post.pricePerSeat}/seat
                </Text>
              </View>
            </View>
            <View style={styles.driverPostActions}>
              <TouchableOpacity
                style={[styles.driverPostBtn, { backgroundColor: colors.secondary }]}
                onPress={() => {
                  markTripRead(post.id);
                  router.push({ pathname: "/post/[id]", params: { id: post.id } });
                }}
              >
                <Feather name="eye" size={13} color={colors.primary} />
                <Text style={[styles.driverPostBtnText, { color: colors.primary }]}>View Replies</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.driverPostBtn, { backgroundColor: "#FEF0F0" }]}
                onPress={() => Alert.alert("Remove Post", "Are you sure you want to remove this adventure post?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Remove", style: "destructive" },
                ])}
              >
                <Feather name="trash-2" size={13} color="#DC2626" />
                <Text style={[styles.driverPostBtnText, { color: "#DC2626" }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

    </>
  );
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

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

function formatSearchDate(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function HomeTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { tripUnreads, markTripRead } = useUnread();

  const [mode, setMode] = useState<"rider" | "driver">("rider");
  const [from, setFrom] = useState<string>(MVP_CITIES[0]);
  const [to, setTo] = useState<string>(MVP_CITIES[1]);
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"from" | "to">("from");

  const [posts, setPosts] = useState<Trip[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = useCallback(async () => {
    setPostsError(null);
    try {
      const rows = await listTrips();
      setPosts(rows);
    } catch (err) {
      setPostsError(err instanceof Error ? err.message : "Couldn't load posts");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setPostsLoading(true);
      loadPosts().finally(() => {
        if (!cancelled) setPostsLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [loadPosts]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  }, [loadPosts]);

  function openPicker(target: "from" | "to") {
    setPickerTarget(target);
    setPickerVisible(true);
  }

  function selectCity(city: CityOption) {
    if (city.status === "coming-soon") {
      Alert.alert(
        `${city.label} — Coming Soon`,
        "We're starting with the Austin ↔ Houston corridor. We'll let you know when this city goes live.",
      );
      return;
    }
    if (pickerTarget === "from") setFrom(city.label);
    else setTo(city.label);
    setPickerVisible(false);
  }

  function swapCities() {
    const tmp = from;
    setFrom(to);
    setTo(tmp);
  }

  function search() {
    if (!isMvpCity(from) || !isMvpCity(to)) {
      Alert.alert("Route not available yet", "Please pick an Austin ↔ Houston route for now.");
      return;
    }
    if (from === to) {
      Alert.alert("Pick two different cities", "Origin and destination must be different.");
      return;
    }
    router.push({ pathname: "/search-results", params: { from, to, date: formatSearchDate(date) } });
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";

  const weatherCity = mode === "rider" ? to : from;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Live weather hero — top 38% of screen, absolute behind scroll */}
      <WeatherBackground
        city={weatherCity}
        height={WEATHER_HEIGHT}
        backgroundColor={colors.background}
      />

      <ScrollView
        style={styles.scrollBase}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16), paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Two-column header: left = greeting + name, right = toggle + weather pill */}
        <View style={styles.topBar}>
          {/* Left column */}
          <View style={styles.topBarLeft}>
            <Text style={[styles.greetLabel, { color: colors.mutedForeground }]}>Hello,</Text>
            <Text style={[styles.greetName, { color: colors.foreground }]}>
              {firstName} <Text style={{ color: colors.primary }}>👋</Text>
            </Text>
          </View>

          {/* Right column: toggle on top, weather pill directly below */}
          <View style={styles.topBarRight}>
            <View style={[styles.modeToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === "rider" && [styles.modeBtnActive, { backgroundColor: colors.primary }]]}
                onPress={() => setMode("rider")}
                activeOpacity={0.8}
              >
                <Feather name="user" size={13} color={mode === "rider" ? "#fff" : colors.mutedForeground} />
                <Text style={[styles.modeBtnText, { color: mode === "rider" ? "#fff" : colors.mutedForeground }]}>
                  Rider
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === "driver" && [styles.modeBtnActive, { backgroundColor: colors.primary }]]}
                onPress={() => setMode("driver")}
                activeOpacity={0.8}
              >
                <Feather name="navigation" size={13} color={mode === "driver" ? "#fff" : colors.mutedForeground} />
                <Text style={[styles.modeBtnText, { color: mode === "driver" ? "#fff" : colors.mutedForeground }]}>
                  Driver
                </Text>
              </TouchableOpacity>
            </View>
            <DestinationWeatherInsight city={weatherCity} align="right" />
          </View>
        </View>

        <View style={{ height: 20 }} />

        {mode === "rider" ? (
          <RiderView
            from={from} to={to} setFrom={setFrom} setTo={setTo}
            dateLabel={formatSearchDate(date)}
            onDatePress={() => setCalendarOpen(true)}
            openPicker={openPicker} swapCities={swapCities} search={search}
            router={router} colors={colors}
            posts={posts} loading={postsLoading} error={postsError}
            tripUnreads={tripUnreads} markTripRead={markTripRead}
          />
        ) : (
          <DriverView
            router={router} colors={colors} user={user}
            posts={posts} loading={postsLoading}
            tripUnreads={tripUnreads} markTripRead={markTripRead}
          />
        )}
      </ScrollView>

      {/* Calendar modal */}
      <Modal visible={calendarOpen} transparent animationType="slide" onRequestClose={() => setCalendarOpen(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card, maxHeight: "75%" }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Select Date</Text>
              <TouchableOpacity onPress={() => setCalendarOpen(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                style={styles.calendarNavBtn}
              >
                <Feather name="chevron-left" size={18} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.calendarMonth, { color: colors.foreground }]}>
                {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </Text>
              <TouchableOpacity
                onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                style={styles.calendarNavBtn}
              >
                <Feather name="chevron-right" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <Text key={i} style={[styles.weekLabel, { color: colors.mutedForeground }]}>{d}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {buildCalendarGrid(calendarMonth.getFullYear(), calendarMonth.getMonth()).map((cell, i) => {
                if (!cell) return <View key={i} style={styles.calendarCell} />;
                const today = startOfDay(new Date());
                const isPast = startOfDay(cell).getTime() < today.getTime();
                const isSelected = startOfDay(cell).getTime() === startOfDay(date).getTime();
                const isToday = startOfDay(cell).getTime() === today.getTime();
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.calendarCell,
                      isSelected && [styles.calendarCellSelected, { backgroundColor: colors.primary }],
                      !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 22 },
                    ]}
                    onPress={() => {
                      if (isPast) return;
                      setDate(cell);
                      setCalendarOpen(false);
                    }}
                    disabled={isPast}
                    activeOpacity={0.75}
                  >
                    <Text style={[
                      styles.calendarDay,
                      {
                        color: isSelected ? "#fff" : isPast ? colors.border : isToday ? colors.primary : colors.foreground,
                        fontFamily: isSelected || isToday ? "Inter_700Bold" : "Inter_500Medium",
                      },
                    ]}>
                      {cell.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* City picker modal */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                Select {pickerTarget === "from" ? "Origin" : "Destination"}
              </Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ALL_CITY_OPTIONS.map((city) => {
                const comingSoon = city.status === "coming-soon";
                return (
                  <TouchableOpacity
                    key={city.label}
                    style={[styles.cityOption, { borderBottomColor: colors.border, opacity: comingSoon ? 0.6 : 1 }]}
                    onPress={() => selectCity(city)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.cityIcon, { backgroundColor: comingSoon ? colors.muted : colors.secondary }]}>
                      <Feather name="map-pin" size={14} color={comingSoon ? colors.mutedForeground : colors.primary} />
                    </View>
                    <Text style={[styles.cityOptionText, { color: colors.foreground }]}>{city.label}</Text>
                    {comingSoon ? (
                      <View style={[styles.comingSoonBadge, { backgroundColor: colors.muted }]}>
                        <Text style={[styles.comingSoonText, { color: colors.mutedForeground }]}>Coming soon</Text>
                      </View>
                    ) : (
                      <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollBase: { flex: 1, backgroundColor: "transparent" },
  scroll: { paddingHorizontal: 22 },

  topBar:      { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  topBarLeft:  { flex: 1, paddingRight: 10 },
  topBarRight: { alignItems: "flex-end" },
  greeting:    {},
  greetLabel:  { fontSize: 13, fontFamily: "Inter_400Regular" },
  greetName:   { fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginTop: 2 },

  modeToggle: { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 3, gap: 3 },
  modeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 11 },
  modeBtnActive: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  modeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  card: { backgroundColor: "#fff", borderRadius: 20, padding: 20, marginBottom: 14, gap: 16 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  routeLeft: { flex: 1, gap: 0 },
  stopRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  stopDot: { width: 10, height: 10, borderRadius: 5 },
  stopContent: { flex: 1, paddingVertical: 6 },
  stopLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 2 },
  cityText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  dottedLine: { marginLeft: 4, height: 18, borderLeftWidth: 2, borderStyle: "dashed" },
  swapBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  divider: { height: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 },
  metaItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  metaSep: { width: 1, height: 20, marginHorizontal: 12 },
  passNum: { fontSize: 16, fontFamily: "Inter_600SemiBold", minWidth: 20, textAlign: "center" },

  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  calendarNavBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  calendarMonth: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  weekRow: { flexDirection: "row", marginBottom: 8 },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarCell: { width: `${100 / 7}%` as any, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  calendarCellSelected: { borderRadius: 22 },
  calendarDay: { fontSize: 14 },

  searchBtn: { height: 56, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 18 },
  searchBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },

  mvpNotice: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 14, marginBottom: 4 },
  mvpNoticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 18 },

  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 14, letterSpacing: -0.2 },

  postsSectionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginTop: 28, marginBottom: 14 },
  postsSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  liveChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  feedState: { flexDirection: "row", alignItems: "center", gap: 10, padding: 18, borderRadius: 14, justifyContent: "center", minHeight: 60 },
  feedStateText: { fontSize: 13, fontFamily: "Inter_400Regular", flexShrink: 1, textAlign: "center" },

  postCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 14, gap: 14 },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  postDriverInfo: { flex: 1, gap: 4 },
  postDriverNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  postDriverName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  topBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  topBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  postRatingRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  postRatingText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  postDot: { fontSize: 10 },
  postRouteRow: { flexDirection: "row", alignItems: "center" },
  postRouteItem: { flexDirection: "row", alignItems: "center", gap: 7 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  postRouteLine: { flex: 1, height: 1 },
  postCityText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  postNote: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  postFooter: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  postMetaChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  postMetaText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  postPrice: { fontSize: 12, fontFamily: "Inter_700Bold" },
  postRepliesRow: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  postRepliesCount: { fontSize: 12, fontFamily: "Inter_500Medium" },
  newDot: { width: 7, height: 7, borderRadius: 4 },

  // Driver view
  driverStatsCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginBottom: 16 },
  driverStatItem: { alignItems: "center", gap: 4 },
  driverStatNum: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  driverStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  driverStatSep: { width: 1, height: 36 },

  postTripCta: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20, padding: 18, marginBottom: 28 },
  postTripCtaIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  postTripCtaText: { flex: 1, gap: 4 },
  postTripCtaTitle: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  postTripCtaSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular" },

  quickActionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  quickActionCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, gap: 10, width: "47%", alignItems: "center" },
  quickActionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  quickActionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },

  driverPostCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, gap: 12, marginBottom: 14 },
  driverPostTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  driverPostRoute: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1 },
  driverPostCity: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  driverPostReplies: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  driverPostRepliesCount: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  driverPostMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  driverPostDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  driverPostSeats: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  driverPostSeatsText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  driverPostActions: { flexDirection: "row", gap: 10 },
  driverPostBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12 },
  driverPostBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12, maxHeight: "75%" },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E3DDD3", alignSelf: "center", marginBottom: 16 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  cityOption: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  cityIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cityOptionText: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  comingSoonBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  comingSoonText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
});
