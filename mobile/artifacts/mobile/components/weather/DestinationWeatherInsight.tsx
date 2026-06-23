import React, { useEffect, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";

import { fetchCityWeather, WEATHER_POLL_MS, type WeatherState } from "@/lib/weather";

const LABELS: Record<WeatherState, (city: string) => string> = {
  "sunny":         (c) => `☀️  ${c} is Sunny`,
  "partly-cloudy": (c) => `🌤  ${c} is Mostly Sunny`,
  "cloudy":        (c) => `☁️  ${c} is Cloudy`,
  "rain":          (c) => `🌧  ${c} is Experiencing Light Rain`,
  "thunderstorm":  (c) => `⛈  ${c} is Experiencing Thunderstorms`,
  "fog":           (c) => `🌫  ${c} is Foggy`,
  "snow":          (c) => `❄️  ${c} is Snowing`,
  "night":         (c) => `🌙  ${c} has Clear Night Skies`,
};

function cityLabel(city: string) {
  return city.replace(/, [A-Z]{2}$/, "");
}

interface Props {
  city: string;
  align?: "left" | "right";
}

export function DestinationWeatherInsight({ city, align = "left" }: Props) {
  const [displayText, setDisplayText] = useState<string>("");
  const opacity    = useRef(new Animated.Value(0)).current;
  const latestCity = useRef(city);
  const mounted    = useRef(true);
  const hasLoaded  = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function applyState(state: WeatherState, forCity: string) {
    if (!mounted.current || latestCity.current !== forCity) return;
    setDisplayText(LABELS[state]?.(cityLabel(forCity)) ?? `☀️  ${cityLabel(forCity)} is Sunny`);
    Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: false }).start();
  }

  function doFetch(forCity: string, fadeOut: boolean) {
    if (fadeOut) {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: false }).start(() => {
        fetchCityWeather(forCity).then((s) => applyState(s, forCity));
      });
    } else {
      fetchCityWeather(forCity).then((s) => applyState(s, forCity));
    }
  }

  useEffect(() => {
    latestCity.current = city;

    // First load: fade in. City change: fade out → update → fade in.
    doFetch(city, hasLoaded.current);
    hasLoaded.current = true;

    // Poll every WEATHER_POLL_MS — silently update text if condition changed
    const timer = setInterval(() => {
      const current = latestCity.current;
      fetchCityWeather(current).then((state) => {
        if (!mounted.current || latestCity.current !== current) return;
        const next = LABELS[state]?.(cityLabel(current)) ?? `☀️  ${cityLabel(current)} is Sunny`;
        // Only animate if text actually changed
        setDisplayText((prev) => {
          if (prev === next) return prev;
          // Quick cross-fade on silent update
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.3, duration: 300, useNativeDriver: false }),
            Animated.timing(opacity, { toValue: 1,   duration: 300, useNativeDriver: false }),
          ]).start();
          return next;
        });
      });
    }, WEATHER_POLL_MS);

    return () => clearInterval(timer);
  }, [city]);

  if (!displayText) return null;

  return (
    <Animated.View
      style={[styles.pillWrap, { opacity, alignItems: align === "right" ? "flex-end" : "flex-start" }]}
    >
      <View
        style={[
          styles.pill,
          Platform.OS === "web" && ({ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" } as object),
        ]}
      >
        <Text style={styles.label} numberOfLines={1}>
          {displayText}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pillWrap: {
    alignItems: "flex-start",
    marginTop: 6,
    marginBottom: 0,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.34)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#FFFFFF",
    letterSpacing: 0.1,
    textShadowColor: "rgba(0,0,0,0.28)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
