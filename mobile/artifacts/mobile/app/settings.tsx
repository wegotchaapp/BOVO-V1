import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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

import { Alert, confirm, showAlert } from "@/lib/alert";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW } from "@/constants/colors";
import { ApiError } from "@/lib/api";
import { getIdentityVerification, type IdentityStatus } from "@/lib/identity";

/** Matches the server's grace period before an account is purged. */
const DELETION_GRACE_DAYS = 7;

function identitySublabel(isVerified: boolean, status: IdentityStatus | null): string {
  if (isVerified || status === "approved") return "Verified ✓";
  if (status === "pending_review") return "Under review";
  if (status === "rejected") return "Needs attention — tap to resubmit";
  return "Upload your government ID and a selfie";
}

// Module scope keeps the component identity stable across renders.
function MenuRow({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  sub: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.card, CARD_SHADOW, styles.menuRow]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{sub}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, logout, deleteAccount, cancelAccountDeletion, deletionScheduledAt } = useAuth();
  const [identityStatus, setIdentityStatus] = useState<IdentityStatus | null>(null);
  const [busy, setBusy] = useState<"logout" | "delete" | null>(null);

  const isDriver = user?.role === "driver";

  // Refreshed on focus, so coming back from the upload screen shows the new state.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getIdentityVerification()
        .then((v) => {
          if (!cancelled) setIdentityStatus(v?.status ?? null);
        })
        // The row falls back to the profile's verified flag.
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleCancelDeletion() {
    try {
      await cancelAccountDeletion();
      Alert.alert("Deletion cancelled", "Your account will remain active.");
    } catch (e: any) {
      Alert.alert("Couldn't cancel", e?.message ?? "Please try again.");
    }
  }

  async function handleLogout() {
    const ok = await confirm("Log out?", "You can sign back in any time.", {
      confirmText: "Log out",
      cancelText: "Cancel",
      destructive: true,
    });
    if (!ok) return;
    setBusy("logout");
    await logout();
    router.replace("/");
  }

  /**
   * A session that has already ended cannot prove who is asking, so the only
   * useful next step is signing back in. Sends them there instead of leaving a
   * dead-end notice.
   */
  function promptSignIn() {
    router.replace("/");
    Alert.alert(
      "Sign in to continue",
      "Your session ended, so we couldn't confirm it's you. Sign in again, then delete your account from Settings.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Sign in", onPress: () => router.push("/login") },
      ],
    );
  }

  async function handleDeleteAccount() {
    // `deleteAccount` no-ops without a signed-in user, which would otherwise
    // read as a successful deletion that never happened.
    if (!user) {
      promptSignIn();
      return;
    }

    const ok = await confirm(
      "Delete your account?",
      `You'll be signed out on every device. Your profile, adventures and data are permanently erased after ${DELETION_GRACE_DAYS} days. Sign back in before then if you change your mind.`,
      { confirmText: "Delete account", cancelText: "Keep account", destructive: true },
    );
    if (!ok) return;

    setBusy("delete");
    try {
      await deleteAccount();
    } catch (e) {
      setBusy(null);
      // The shared 401 handler has signed the user out by now.
      if (e instanceof ApiError && e.status === 401) {
        promptSignIn();
        return;
      }
      Alert.alert(
        "Couldn't delete your account",
        e instanceof Error ? e.message : "Please try again in a moment.",
      );
      return;
    }

    const purgeOn = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
    router.replace("/");
    void showAlert(
      "Account deletion scheduled",
      `You've been signed out. Your account will be permanently deleted on ${purgeOn.toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Sign in before then to cancel.`,
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, CARD_SHADOW]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>{user?.name}</Text>
          <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{user?.email}</Text>
          {user?.phone ? (
            <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{user.phone}</Text>
          ) : null}
        </View>

        <MenuRow
          icon="credit-card"
          title="Identity verification"
          sub={identitySublabel(!!user?.isVerified, identityStatus)}
          onPress={() => router.push("/verify")}
        />

        {isDriver ? (
          <MenuRow
            icon="truck"
            title="My vehicles"
            sub="Add a vehicle or check its review"
            onPress={() => router.push("/vehicles")}
          />
        ) : null}

        <MenuRow
          icon="bell"
          title="Notifications"
          sub="Push, email, and trip alerts"
          onPress={() => router.push("/notifications")}
        />

        <MenuRow
          icon="sliders"
          title="Travel preferences"
          sub={
            user?.preferencesCount
              ? `${user.preferencesCount} of 10 set`
              : "Set your travel preferences"
          }
          onPress={() => router.push("/preferences")}
        />

        <View style={[styles.card, CARD_SHADOW]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PRIVACY</Text>
          <Text style={[styles.privacyText, { color: colors.foreground }]}>
            Deleting your account signs you out everywhere. Bovogo keeps your data for a{" "}
            {DELETION_GRACE_DAYS}-day grace period (CCPA), then permanently erases it from our
            servers.
          </Text>
          {deletionScheduledAt ? (
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.secondary }]}
              onPress={handleCancelDeletion}
            >
              <Text style={[styles.cancelBtnText, { color: colors.primary }]}>
                Cancel scheduled deletion
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, { backgroundColor: "#FEF0F0", opacity: busy ? 0.6 : 1 }]}
          onPress={handleLogout}
          disabled={!!busy}
          activeOpacity={0.8}
        >
          {busy === "logout" ? (
            <ActivityIndicator color={colors.destructive} />
          ) : (
            <>
              <Feather name="log-out" size={16} color={colors.destructive} />
              <Text style={[styles.logoutText, { color: colors.destructive }]}>Log Out</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Once deletion is scheduled the only useful action is cancelling it. */}
        {!deletionScheduledAt ? (
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: "#FECACA", opacity: busy === "logout" ? 0.6 : 1 }]}
            onPress={handleDeleteAccount}
            disabled={!!busy}
            activeOpacity={0.8}
          >
            {busy === "delete" ? (
              <>
                <ActivityIndicator size="small" color="#DC2626" />
                <Text style={[styles.deleteText, { color: "#DC2626" }]}>Deleting…</Text>
              </>
            ) : (
              <>
                <Feather name="trash-2" size={15} color="#DC2626" />
                <Text style={[styles.deleteText, { color: "#DC2626" }]}>Delete Account</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 20, gap: 14, paddingBottom: 40 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 16, gap: 6 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  rowLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  privacyText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  cancelBtn: {
    marginTop: 10,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 16,
    marginTop: 6,
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
});
