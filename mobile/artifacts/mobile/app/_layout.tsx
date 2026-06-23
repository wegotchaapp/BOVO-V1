import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { UnreadProvider } from "@/context/UnreadContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Watches for an active ride and redirects the user to the live tracking
 * screen when they open the app mid-trip. Only redirects once per session
 * so the user can freely navigate away from tracking without being
 * immediately pushed back.
 */
function ActiveRideGuard() {
  const { user, activeRideId, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user || !activeRideId) return;
    if (hasRedirected.current) return;

    // Don't redirect if already on the tracking screen
    const onTracking = segments.some((s) => s === "tracking");
    if (onTracking) {
      hasRedirected.current = true;
      return;
    }

    // Redirect once to the live tracking screen
    hasRedirected.current = true;
    router.replace({
      pathname: "/tracking/[id]",
      params: { id: activeRideId },
    });
  }, [isLoading, user, activeRideId, segments]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <ActiveRideGuard />
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="verify" options={{ title: "Verify Identity" }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="search-results" options={{ headerShown: false }} />
        <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="booking-confirmed" options={{ headerShown: false }} />
        <Stack.Screen name="safety" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="tracking/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="payment" options={{ headerShown: false }} />
        <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="post-trip" options={{ headerShown: false }} />
        <Stack.Screen name="earnings" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle" options={{ headerShown: false }} />
        <Stack.Screen name="safety-unsafe" options={{ headerShown: false }} />
        <Stack.Screen name="rate-trip/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="subscribe"
          options={{ headerShown: false, presentation: "modal" }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <AuthProvider>
                <UnreadProvider>
                  <RootLayoutNav />
                </UnreadProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
