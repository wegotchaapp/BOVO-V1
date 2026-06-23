import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StripeProvider, useStripe } from "@/lib/stripeNative";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { CARD_SHADOW, STRONG_SHADOW } from "@/constants/colors";
import { apiClient } from "@/lib/api";

interface StartResponse {
  subscriptionId: string;
  status: string;
  clientSecret: string | null;
  publishableKey: string;
  trialEndsAt?: string | null;
}

function SubscribeBody() {
  const router = useRouter();
  const c = useColors();
  const { user, refreshMe } = useAuth();
  const subtext = c.mutedForeground;
  const stripe = useStripe();
  const [loading, setLoading] = useState(false);

  const isFoundingMember = Boolean(user?.isFoundingMember);
  const hasSubscription = Boolean(user?.subscriptionStatus);
  const trialEnds = user?.trialEndsAt;

  async function handleSubscribe() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await apiClient.post<StartResponse>(
        "/subscriptions/start",
        {},
      );

      // If a payment method needs to be collected, open the Payment Sheet.
      if (res.clientSecret && Platform.OS !== "web") {
        // Either a SetupIntent (trial-only, no immediate charge) or a
        // PaymentIntent. The Payment Sheet accepts whichever shape we pass.
        const sheetParams =
          res.clientSecret.startsWith("seti_")
            ? { setupIntentClientSecret: res.clientSecret }
            : { paymentIntentClientSecret: res.clientSecret };
        const init = await stripe.initPaymentSheet({
          merchantDisplayName: "Bovogo",
          allowsDelayedPaymentMethods: true,
          ...sheetParams,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
        if (init.error) throw new Error(init.error.message);

        const present = await stripe.presentPaymentSheet();
        if (present.error) {
          if (present.error.code !== "Canceled") {
            throw new Error(present.error.message);
          }
          // User canceled — keep subscription in incomplete state and exit.
          setLoading(false);
          return;
        }
      }

      await refreshMe();
      Alert.alert(
        "Welcome to Premium",
        isFoundingMember
          ? "Your 1-year free trial has started. You won't be charged until next year."
          : "Your subscription is active.",
        [{ text: "Done", onPress: () => router.back() }],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Subscription failed";
      Alert.alert("Could not start subscription", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Feather name="x" size={24} color={c.foreground} />
        </TouchableOpacity>

        <View style={[styles.heroCard, CARD_SHADOW, { backgroundColor: c.primary }]}>
          <Feather name="award" size={36} color={c.accent} />
          <Text style={[styles.heroTitle, { color: c.background }]}>
            Bovogo Premium
          </Text>
          <Text style={[styles.heroPrice, { color: c.background }]}>$22 / month</Text>
          {isFoundingMember && (
            <View style={[styles.foundingPill, { backgroundColor: c.accent }]}>
              <Feather name="star" size={12} color={c.primary} />
              <Text style={[styles.foundingPillText, { color: c.primary }]}>
                1 year free for founding members
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.benefitsCard, CARD_SHADOW, { backgroundColor: c.card }]}>
          {[
            "Priority matching in busy corridors",
            "No service fee on any Adventure",
            "Voyager perks: featured posts, earlier seat releases",
            "Dedicated support",
          ].map((b) => (
            <View key={b} style={styles.benefitRow}>
              <Feather name="check-circle" size={18} color={c.success} />
              <Text style={[styles.benefitText, { color: c.foreground }]}>{b}</Text>
            </View>
          ))}
        </View>

        {hasSubscription ? (
          <View style={[styles.statusCard, { backgroundColor: c.card }]}>
            <Text style={[styles.statusLabel, { color: subtext }]}>
              Current status
            </Text>
            <Text style={[styles.statusValue, { color: c.foreground }]}>
              {user?.subscriptionStatus ?? "—"}
            </Text>
            {trialEnds && (
              <Text style={[styles.statusSub, { color: subtext }]}>
                Trial ends {new Date(trialEnds).toLocaleDateString()}
              </Text>
            )}
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleSubscribe}
            disabled={loading}
            style={[
              styles.cta,
              STRONG_SHADOW,
              { backgroundColor: c.primary, opacity: loading ? 0.7 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={c.background} />
            ) : (
              <Text style={[styles.ctaText, { color: c.background }]}>
                {isFoundingMember
                  ? "Start free year"
                  : "Subscribe — $22/month"}
              </Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={[styles.fine, { color: subtext }]}>
          You can cancel anytime in your profile. By subscribing you agree to
          Bovogo's terms of service.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function SubscribeScreen() {
  // Server is the source of truth for the publishable key (ensures the key
  // matches the Stripe account the backend uses). Fall back to env var on
  // initial render so StripeProvider can mount without a flash.
  const envKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  const [pubKey, setPubKey] = useState(envKey);
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ publishableKey: string }>("/subscriptions/config")
      .then((cfg) => {
        if (!cancelled && cfg.publishableKey) setPubKey(cfg.publishableKey);
      })
      .catch(() => {
        // Non-fatal — start endpoint also returns the key and will surface
        // a clearer error if Stripe isn't configured.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <StripeProvider publishableKey={pubKey} merchantIdentifier="merchant.com.bovogo">
      <SubscribeBody />
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 18 },
  backBtn: { alignSelf: "flex-end", padding: 4 },
  heroCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  heroTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
  },
  heroPrice: { fontFamily: "Inter_600SemiBold", fontSize: 18 },
  foundingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 6,
  },
  foundingPillText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  benefitsCard: { borderRadius: 20, padding: 18, gap: 12 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitText: { fontFamily: "Inter_500Medium", fontSize: 15, flex: 1 },
  cta: {
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  ctaText: { fontFamily: "Inter_700Bold", fontSize: 16, letterSpacing: -0.3 },
  statusCard: { borderRadius: 20, padding: 18, gap: 4 },
  statusLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  statusValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    textTransform: "capitalize",
  },
  statusSub: { fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 4 },
  fine: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 16,
    marginTop: 4,
  },
});
