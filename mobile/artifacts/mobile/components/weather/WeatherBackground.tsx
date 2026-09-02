import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { fetchCityWeather, WEATHER_POLL_MS, type WeatherState } from "@/lib/weather";
import { SunnyScene }        from "./SunnyScene";
import { NightScene }        from "./NightScene";
import { RainScene }         from "./RainScene";
import { ThunderstormScene } from "./ThunderstormScene";
import { CloudyScene }       from "./CloudyScene";
import { FogScene }          from "./FogScene";
import { SnowScene }         from "./SnowScene";
import { PartlyCloudyScene } from "./PartlyCloudyScene";

function Scene({ weather, height }: { weather: WeatherState; height: number }) {
  switch (weather) {
    case "sunny":         return <SunnyScene        height={height} />;
    case "partly-cloudy": return <PartlyCloudyScene height={height} />;
    case "cloudy":        return <CloudyScene       height={height} />;
    case "rain":          return <RainScene         height={height} />;
    case "thunderstorm":  return <ThunderstormScene height={height} />;
    case "fog":           return <FogScene          height={height} />;
    case "snow":          return <SnowScene         height={height} />;
    case "night":         return <NightScene        height={height} />;
    default:              return <SunnyScene        height={height} />;
  }
}

interface Props {
  city: string;
  height: number;
  backgroundColor: string;
  /**
   * Fraction of `height` left as pure, unwashed weather before the legibility
   * wash fades in. Content below that point still shows the live scene through
   * a translucent tint so the weather reads across the whole page.
   */
  heroStop?: number;
}

/** `#RRGGBB` → `rgba(r,g,b,alpha)`, so the wash can tint without hiding. */
function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = parseInt(full, 16);
  if (Number.isNaN(int)) return `rgba(248,247,243,${alpha})`;
  return `rgba(${(int >> 16) & 255},${(int >> 8) & 255},${int & 255},${alpha})`;
}

export function WeatherBackground({ city, height, backgroundColor, heroStop = 0.34 }: Props) {
  const [slotA, setSlotA] = useState<WeatherState>("sunny");
  const [slotB, setSlotB] = useState<WeatherState>("sunny");
  const activeSlot = useRef<"A" | "B">("A");
  const opacityA   = useRef(new Animated.Value(1)).current;
  const opacityB   = useRef(new Animated.Value(0)).current;
  const inFlight   = useRef(false);
  const latestCity = useRef(city);
  const mounted    = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  function crossFadeTo(next: WeatherState) {
    if (inFlight.current) return;
    const current = activeSlot.current;
    if (current === "A") {
      setSlotB(next);
      inFlight.current = true;
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacityA, { toValue: 0, duration: 1600, useNativeDriver: false }),
          Animated.timing(opacityB, { toValue: 1, duration: 1600, useNativeDriver: false }),
        ]).start(() => { activeSlot.current = "B"; inFlight.current = false; });
      }, 60);
    } else {
      setSlotA(next);
      inFlight.current = true;
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacityB, { toValue: 0, duration: 1600, useNativeDriver: false }),
          Animated.timing(opacityA, { toValue: 1, duration: 1600, useNativeDriver: false }),
        ]).start(() => { activeSlot.current = "A"; inFlight.current = false; });
      }, 60);
    }
  }

  function doFetch(forCity: string) {
    fetchCityWeather(forCity).then((state) => {
      if (!mounted.current || latestCity.current !== forCity) return;
      const current = activeSlot.current === "A" ? slotA : slotB;
      if (state !== current) crossFadeTo(state);
    });
  }

  useEffect(() => {
    latestCity.current = city;

    // Immediate fetch on city change
    doFetch(city);

    // Poll every WEATHER_POLL_MS so conditions update even if city stays the same
    const timer = setInterval(() => doFetch(latestCity.current), WEATHER_POLL_MS);
    return () => clearInterval(timer);
  }, [city]);

  const wash = withAlpha(backgroundColor, 0.82);
  const fadeStart = Math.min(heroStop, 0.9);
  const fadeEnd = Math.min(fadeStart + 0.12, 1);

  return (
    // `pointerEvents` must be the prop, not a style key — as a style it does not
    // reach the DOM under react-native-web and the scene swallows every click.
    <View pointerEvents="none" style={[styles.root, { height }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityA }]}>
        <Scene weather={slotA} height={height} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityB }]}>
        <Scene weather={slotB} height={height} />
      </Animated.View>
      {/* Legibility wash: pure weather down to `heroStop`, then a translucent
          tint the rest of the way so content stays readable over live sky. */}
      <LinearGradient
        colors={["transparent", "transparent", wash, wash]}
        locations={[0, fadeStart, fadeEnd, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Header scrim. Skies range from bright noon blue to near-black night,
          so darken the top band and let header text render light — the only
          treatment that holds contrast across every scene. */}
      <LinearGradient
        colors={["rgba(10,20,16,0.45)", "rgba(10,20,16,0.12)", "transparent"]}
        style={styles.topScrim}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0, height: 230 },
});
