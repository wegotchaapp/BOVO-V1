import React from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SunnyScene }        from "@/components/weather/SunnyScene";
import { PartlyCloudyScene } from "@/components/weather/PartlyCloudyScene";
import { CloudyScene }       from "@/components/weather/CloudyScene";
import { RainScene }         from "@/components/weather/RainScene";
import { ThunderstormScene } from "@/components/weather/ThunderstormScene";
import { FogScene }          from "@/components/weather/FogScene";
import { SnowScene }         from "@/components/weather/SnowScene";
import { NightScene }        from "@/components/weather/NightScene";

const { width } = Dimensions.get("window");
const CARD_W = (width - 48) / 2;
const CARD_H = 180;

const SCENES = [
  { label: "☀️ Sunny",          Scene: SunnyScene        },
  { label: "⛅ Partly Cloudy",  Scene: PartlyCloudyScene },
  { label: "☁️ Cloudy",          Scene: CloudyScene       },
  { label: "🌧 Rain",            Scene: RainScene         },
  { label: "⛈ Thunderstorm",   Scene: ThunderstormScene },
  { label: "🌫 Fog",             Scene: FogScene          },
  { label: "❄️ Snow",            Scene: SnowScene         },
  { label: "🌙 Clear Night",     Scene: NightScene        },
] as const;

export default function WeatherDemoScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Weather Animations</Text>
      <Text style={styles.sub}>All 8 scenes — live and animated</Text>

      <View style={styles.grid}>
        {SCENES.map(({ label, Scene }) => (
          <View key={label} style={styles.card}>
            <View style={[styles.sceneWrap, { width: CARD_W, height: CARD_H }]}>
              <Scene height={CARD_H} />
            </View>
            <Text style={styles.label}>{label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#F8F7F3" },
  content: { paddingTop: 60, paddingBottom: 40, paddingHorizontal: 16 },

  heading: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1B3D2F", letterSpacing: -0.5, marginBottom: 4 },
  sub:     { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 24 },

  grid:  { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  card:  { width: CARD_W },

  sceneWrap: { borderRadius: 18, overflow: "hidden" },
  label:     { marginTop: 8, fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#374151", textAlign: "center" },
});
