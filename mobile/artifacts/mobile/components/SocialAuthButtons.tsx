import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getGoogleClientIds } from "@/lib/socialAuth";

WebBrowser.maybeCompleteAuthSession();

export function SocialAuthButtons() {
  const colors = useColors();
  const router = useRouter();
  const { loginWithOAuth } = useAuth();
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);
  const googleIds = getGoogleClientIds();

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: googleIds.web || undefined,
    iosClientId: googleIds.ios || undefined,
    androidClientId: googleIds.android || undefined,
  });

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken =
      response.authentication?.idToken ||
      (response.params as { id_token?: string } | undefined)?.id_token;
    if (!idToken) {
      Alert.alert(
        "Google Sign-In",
        "Google did not return an ID token. Use a Web OAuth client ID in EXPO_PUBLIC_GOOGLE_CLIENT_ID.",
      );
      setBusy(null);
      return;
    }
    (async () => {
      try {
        setBusy("google");
        const user = await loginWithOAuth({ provider: "google", idToken });
        router.replace(user.onboarded ? "/(tabs)" : "/onboarding");
      } catch (e: any) {
        Alert.alert("Google Sign-In failed", e?.message ?? "Please try again.");
      } finally {
        setBusy(null);
      }
    })();
  }, [response, loginWithOAuth, router]);

  async function handleGoogle() {
    if (!googleIds.configured) {
      Alert.alert(
        "Google Sign-In not configured",
        "Add EXPO_PUBLIC_GOOGLE_CLIENT_ID to mobile/.env (Google Cloud Console → OAuth 2.0 Web client ID), then restart Expo.",
      );
      return;
    }
    setBusy("google");
    try {
      await promptAsync();
    } catch (e: any) {
      Alert.alert("Google Sign-In failed", e?.message ?? "Please try again.");
      setBusy(null);
    }
  }

  async function handleApple() {
    if (Platform.OS !== "ios") {
      Alert.alert(
        "Apple Sign-In",
        "Apple Sign-In is only available on iPhone and iPad.",
      );
      return;
    }
    setBusy("apple");
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        throw new Error("Apple Sign-In is not available on this device.");
      }
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("Apple did not return an identity token.");
      }
      const name = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ");
      const user = await loginWithOAuth({
        provider: "apple",
        idToken: credential.identityToken,
        email: credential.email ?? undefined,
        name: name || undefined,
      });
      router.replace(user.onboarded ? "/(tabs)" : "/onboarding");
    } catch (e: any) {
      if (e?.code === "ERR_REQUEST_CANCELED") return;
      Alert.alert("Apple Sign-In failed", e?.message ?? "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.socialRow}>
      <TouchableOpacity
        style={[styles.socialBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={handleGoogle}
        disabled={busy !== null || !request}
        activeOpacity={0.85}
      >
        {busy === "google" ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Text style={styles.socialIcon}>🇬</Text>
            <Text style={[styles.socialText, { color: colors.foreground }]}>Google</Text>
          </>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.socialBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={handleApple}
        disabled={busy !== null}
        activeOpacity={0.85}
      >
        {busy === "apple" ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Text style={styles.socialIcon}>🍎</Text>
            <Text style={[styles.socialText, { color: colors.foreground }]}>Apple</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  socialRow: { flexDirection: "row", gap: 12 },
  socialBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  socialIcon: { fontSize: 18 },
  socialText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
