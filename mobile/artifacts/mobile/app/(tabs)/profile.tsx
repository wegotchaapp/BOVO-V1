import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";

interface MenuItem {
  icon: string;
  label: string;
  sublabel?: string;
  route?: string;
  action?: () => void;
  danger?: boolean;
  badge?: string;
}

interface BenefitRow {
  label: string;
  free: string | boolean;
  plus: string | boolean;
}

const TRAVEL_PLUS_BENEFITS: BenefitRow[] = [
  { label: "Service fee on bookings", free: "12%", plus: "0%" },
  { label: "Priority match in queue", free: false, plus: true },
  { label: "Free trip cancellation", free: "1/mo", plus: "Unlimited" },
  { label: "Premium driver badge", free: false, plus: true },
  { label: "24/7 priority support", free: false, plus: true },
];

export default function ProfileTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, deleteAccount, deletionScheduledAt } = useAuth();

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const isDriver = user?.role === "driver";

  const menuGroups: { title: string; items: MenuItem[] }[] = [
    {
      title: "Account",
      items: [
        { icon: "map", label: "My Adventures", sublabel: `${user?.trips ?? 0} trips`, route: "/(tabs)/trips" },
        { icon: "sliders", label: "Travel Preferences", sublabel: "10 preferences set", route: "/preferences" },
        { icon: "bell", label: "Notifications", sublabel: "Manage alerts", action: () => Alert.alert("Notifications", "Notification settings coming soon.") },
      ],
    },
    ...(isDriver
      ? [
          {
            title: "Voyager",
            items: [
              { icon: "send", label: "Post an Adventure", sublabel: "Announce your next drive", route: "/post-trip", badge: "New" },
              { icon: "truck", label: "My Vehicle", sublabel: "Manage your registered car", route: "/vehicle" },
              { icon: "dollar-sign", label: "Savings", sublabel: "Cost-sharing dashboard", route: "/earnings" },
            ],
          },
        ]
      : []),
    {
      title: "Safety",
      items: [
        { icon: "shield", label: "Verifications", sublabel: user?.isVerified ? "ID verified ✓" : "Complete verification", action: () => router.push("/verify") },
        { icon: "alert-triangle", label: "Safety Center", sublabel: "SOS, emergency contacts", route: "/safety" },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: "help-circle", label: "Help & Support", action: () => router.push({ pathname: "/chat/[id]", params: { id: "c4" } }) },
        { icon: "file-text", label: "Privacy & Data", action: () => Alert.alert("Privacy", "Data export and deletion requests can be submitted through support.") },
        { icon: "settings", label: "Settings", action: () => Alert.alert("Settings", "Coming soon.") },
      ],
    },
  ];

  async function handleLogout() {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/");
        },
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your Bovogo account?\n\nYour profile, trip history, and data will be permanently erased after a 7-day grace period. You can contact support within 7 days to cancel this request.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Schedule Deletion",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirm Account Deletion",
              "This will log you out immediately. Your data will be permanently deleted in 7 days.\n\nContact support@wegotcha.com within 7 days to reverse this.",
              [
                { text: "Go Back", style: "cancel" },
                {
                  text: "Yes, Delete My Account",
                  style: "destructive",
                  onPress: async () => {
                    await deleteAccount();
                    router.replace("/");
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }

  const deletionDate = deletionScheduledAt
    ? new Date(new Date(deletionScheduledAt).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;

  const badges = [
    { icon: "check-circle", label: "Verified", color: "#059669", bg: "#ECFDF5", show: user?.isVerified },
    { icon: "award", label: "Top Rider", color: "#C4954A", bg: "#FEF3E2", show: (user?.trips ?? 0) >= 5 },
    { icon: "map-pin", label: "Texan", color: colors.primary, bg: colors.secondary, show: true },
  ].filter((b) => b.show);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16), paddingBottom: insets.bottom + 110 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.heading, { color: colors.foreground }]}>Profile</Text>

      {/* Pending deletion warning banner */}
      {deletionDate && (
        <View style={[styles.deletionBanner, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
          <Feather name="alert-circle" size={16} color="#DC2626" />
          <View style={styles.deletionBannerText}>
            <Text style={[styles.deletionBannerTitle, { color: "#DC2626" }]}>Account Deletion Scheduled</Text>
            <Text style={[styles.deletionBannerSub, { color: "#7F1D1D" }]}>
              Your account will be permanently deleted on{" "}
              {deletionDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
              Contact support to cancel.
            </Text>
          </View>
        </View>
      )}

      <View style={[styles.profileCard, CARD_SHADOW]}>
        <TouchableOpacity
          style={[styles.avatarWrap, { backgroundColor: colors.secondary }]}
          onPress={() => Alert.alert("Edit Photo", "Photo upload available at launch.")}
          activeOpacity={0.85}
        >
          <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
          {user?.isFoundingMember && (
            <View style={styles.crownOverlay}>
              <Feather name="award" size={16} color="#C4954A" />
            </View>
          )}
          <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
            <Feather name="camera" size={12} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name ?? "User"}</Text>

        <View style={styles.badgesRow}>
          {user?.isFoundingMember && (
            <View style={[styles.driverBadge, { backgroundColor: "#FEF3E2" }]}>
              <Feather name="award" size={11} color="#C4954A" />
              <Text style={[styles.driverBadgeText, { color: "#C4954A" }]}>Founding Member</Text>
            </View>
          )}
          {isDriver && (
            <View style={[styles.driverBadge, { backgroundColor: "#FEF3E2" }]}>
              <Feather name="navigation" size={11} color="#C4954A" />
              <Text style={[styles.driverBadgeText, { color: "#C4954A" }]}>Verified Voyager</Text>
            </View>
          )}
          {badges.map((b) => (
            <View key={b.label} style={[styles.badge, { backgroundColor: b.bg }]}>
              <Feather name={b.icon as any} size={10} color={b.color} />
              <Text style={[styles.badgeText, { color: b.color }]}>{b.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <View style={styles.statValueRow}>
              <Text style={[styles.statNum, { color: colors.foreground }]}>{user?.rating ?? "5.0"}</Text>
              <Feather name="star" size={14} color="#C4954A" />
            </View>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Rating</Text>
          </View>
          <View style={[styles.statSep, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>{user?.trips ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Adventures</Text>
          </View>
          <View style={[styles.statSep, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: colors.foreground }]}>TX</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Region</Text>
          </View>
        </View>
      </View>

      {/* Travel+ Subscription card */}
      <View style={[styles.travelPlusCard, CARD_SHADOW]}>
        <View style={styles.travelPlusHeader}>
          <View style={styles.travelPlusBadge}>
            <Feather name="zap" size={12} color="#fff" />
            <Text style={styles.travelPlusBadgeText}>TRAVEL+</Text>
          </View>
          <Text style={styles.travelPlusPrice}>
            $22<Text style={styles.travelPlusPriceUnit}>/mo</Text>
          </Text>
        </View>
        <Text style={styles.travelPlusTitle}>Unlock the full Bovogo experience</Text>
        <Text style={styles.travelPlusSub}>
          Save more, ride priority, and travel like a regular.
        </Text>

        <View style={styles.compareTable}>
          <View style={styles.compareHeaderRow}>
            <Text style={[styles.compareHeaderCell, { flex: 1.6, textAlign: "left" }]}>Benefit</Text>
            <Text style={[styles.compareHeaderCell, { flex: 1 }]}>Free</Text>
            <View style={[styles.comparePlusCell, { flex: 1 }]}>
              <Feather name="zap" size={9} color="#fff" />
              <Text style={styles.comparePlusHeaderText}>Travel+</Text>
            </View>
          </View>

          {TRAVEL_PLUS_BENEFITS.map((row, i) => (
            <View
              key={row.label}
              style={[
                styles.compareRow,
                i < TRAVEL_PLUS_BENEFITS.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.12)",
                },
              ]}
            >
              <Text style={[styles.compareLabel, { flex: 1.6 }]}>{row.label}</Text>
              <View style={[styles.compareCell, { flex: 1 }]}>
                {row.free === false ? (
                  <Feather name="x" size={14} color="rgba(255,255,255,0.5)" />
                ) : row.free === true ? (
                  <Feather name="check" size={14} color="rgba(255,255,255,0.7)" />
                ) : (
                  <Text style={styles.compareFreeText}>{row.free}</Text>
                )}
              </View>
              <View style={[styles.compareCell, { flex: 1 }]}>
                {row.plus === true ? (
                  <Feather name="check" size={15} color={colors.accent} />
                ) : (
                  <Text style={styles.comparePlusText}>{row.plus}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.travelPlusCta, { backgroundColor: colors.accent }]}
          onPress={() => router.push("/subscribe")}
          activeOpacity={0.88}
        >
          <Text style={styles.travelPlusCtaText}>
            {user?.subscriptionStatus
              ? "Manage subscription"
              : user?.isFoundingMember
                ? "Start 1-year free trial"
                : "Subscribe — $22/month"}
          </Text>
          <Feather name="arrow-right" size={16} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.travelPlusFinePrint}>
          {user?.isFoundingMember
            ? "Founding members get 1 year free · Cancel anytime · $22/month after"
            : "Cancel anytime · $22/month"}
        </Text>
      </View>

      {menuGroups.map((group) => (
        <View key={group.title} style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{group.title.toUpperCase()}</Text>
          <View style={[styles.menuCard, CARD_SHADOW]}>
            {group.items.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.menuItem,
                  idx < group.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
                onPress={item.action ?? (() => item.route && router.push(item.route as any))}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIcon, { backgroundColor: group.title === "Voyager" ? "#F0FAF4" : colors.secondary }]}>
                  <Feather name={item.icon as any} size={16} color={group.title === "Voyager" ? colors.success : colors.primary} />
                </View>
                <View style={styles.menuContent}>
                  <View style={styles.menuLabelRow}>
                    <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
                    {item.badge && (
                      <View style={[styles.newBadge, { backgroundColor: colors.accent }]}>
                        <Text style={styles.newBadgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </View>
                  {item.sublabel && (
                    <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>{item.sublabel}</Text>
                  )}
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: "#FEF0F0" }]}
        onPress={handleLogout}
        activeOpacity={0.8}
      >
        <Feather name="log-out" size={16} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>Log Out</Text>
      </TouchableOpacity>

      {/* Delete Account — separate, clearly destructive */}
      <TouchableOpacity
        style={[styles.deleteBtn, { borderColor: "#FECACA" }]}
        onPress={handleDeleteAccount}
        activeOpacity={0.8}
      >
        <Feather name="trash-2" size={15} color="#DC2626" />
        <Text style={[styles.deleteText, { color: "#DC2626" }]}>Delete Account</Text>
      </TouchableOpacity>

      <View style={styles.deleteNote}>
        <Feather name="info" size={11} color={colors.mutedForeground} />
        <Text style={[styles.deleteNoteText, { color: colors.mutedForeground }]}>
          Account data is retained for 7 days after deletion request, then permanently erased.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.version, { color: colors.mutedForeground }]}>Bovogo v1.0.0 — Texas MVP</Text>
        <Text style={[styles.compliance, { color: colors.mutedForeground }]}>
          Cost-sharing platform · Not a TNC · IRS §162 compliant
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 22, gap: 16 },
  heading: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },

  deletionBanner: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  deletionBannerText: { flex: 1, gap: 3 },
  deletionBannerTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  deletionBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },

  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 28, fontFamily: "Inter_700Bold" },
  crownOverlay: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF3E2",
    borderWidth: 2,
    borderColor: "#fff",
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  name: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  driverBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  driverBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statsDivider: { width: "100%", height: 1, marginVertical: 4 },
  statsRow: { flexDirection: "row", width: "100%", justifyContent: "space-around" },
  stat: { alignItems: "center", gap: 4 },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statSep: { width: 1, height: 36 },
  menuSection: { gap: 8 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, paddingHorizontal: 4 },
  menuCard: { backgroundColor: "#fff", borderRadius: 18, overflow: "hidden" },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  menuContent: { flex: 1, gap: 2 },
  menuLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  newBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  newBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  menuSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 16,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#FFF5F5",
  },
  deleteText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  deleteNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    paddingHorizontal: 4,
    marginTop: -6,
  },
  deleteNoteText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  // ── Travel+ subscription card ─────────────────────────────────────────
  travelPlusCard: {
    backgroundColor: "#1B3D2F",
    borderRadius: 22,
    padding: 20,
    gap: 14,
  },
  travelPlusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  travelPlusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#C4954A",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  travelPlusBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  travelPlusPrice: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  travelPlusPriceUnit: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)" },
  travelPlusTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_600SemiBold", letterSpacing: -0.3 },
  travelPlusSub: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  compareTable: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 4,
  },
  compareHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.18)",
    gap: 8,
  },
  compareHeaderCell: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  comparePlusCell: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#C4954A",
    paddingVertical: 4,
    borderRadius: 8,
  },
  comparePlusHeaderText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    gap: 8,
  },
  compareLabel: { color: "rgba(255,255,255,0.92)", fontSize: 13, fontFamily: "Inter_400Regular" },
  compareCell: { alignItems: "center", justifyContent: "center" },
  compareFreeText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center" },
  comparePlusText: { color: "#C4954A", fontSize: 12, fontFamily: "Inter_700Bold", textAlign: "center" },

  travelPlusCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 25,
    marginTop: 4,
  },
  travelPlusCtaText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  travelPlusFinePrint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: -4,
  },

  footer: { alignItems: "center", gap: 4, paddingVertical: 4 },
  version: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  compliance: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
});
