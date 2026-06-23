import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

interface Question {
  id: string;
  icon: string;
  question: string;
  subtext?: string;
  options: { label: string; emoji?: string }[];
}

const QUESTIONS: Question[] = [
  {
    id: "smoke",
    icon: "wind",
    question: "Do you smoke?",
    subtext: "Including e-cigarettes and vapes",
    options: [
      { label: "No, never", emoji: "✅" },
      { label: "Only outside", emoji: "🚗" },
      { label: "Yes", emoji: "🚬" },
    ],
  },
  {
    id: "talk",
    icon: "message-square",
    question: "How talkative are you?",
    subtext: "During the ride",
    options: [
      { label: "Quiet, please", emoji: "🤫" },
      { label: "Just the basics", emoji: "💬" },
      { label: "Love to chat", emoji: "😄" },
    ],
  },
  {
    id: "music",
    icon: "music",
    question: "Music preference?",
    options: [
      { label: "Silence is golden", emoji: "🔇" },
      { label: "Soft background", emoji: "🎵" },
      { label: "Whatever you like", emoji: "🎶" },
    ],
  },
  {
    id: "pets",
    icon: "heart",
    question: "Bringing a pet?",
    options: [
      { label: "No pets", emoji: "🚫" },
      { label: "Small pet, crated", emoji: "🐾" },
      { label: "Dog, on leash", emoji: "🐕" },
    ],
  },
  {
    id: "ac",
    icon: "thermometer",
    question: "AC preference?",
    options: [
      { label: "Always on", emoji: "❄️" },
      { label: "Moderate", emoji: "🌤" },
      { label: "No AC needed", emoji: "🌞" },
    ],
  },
  {
    id: "food",
    icon: "coffee",
    question: "Food & drinks in the car?",
    options: [
      { label: "No food, please", emoji: "🚫" },
      { label: "Light snacks only", emoji: "🍿" },
      { label: "Anything goes", emoji: "🍔" },
    ],
  },
  {
    id: "stops",
    icon: "map-pin",
    question: "Comfort stops?",
    options: [
      { label: "No extra stops", emoji: "🏎" },
      { label: "One short stop", emoji: "⛽" },
      { label: "Flexible", emoji: "🛑" },
    ],
  },
  {
    id: "luggage",
    icon: "briefcase",
    question: "Luggage size?",
    options: [
      { label: "Just a backpack", emoji: "🎒" },
      { label: "One carry-on", emoji: "🧳" },
      { label: "Large suitcase", emoji: "🪣" },
    ],
  },
  {
    id: "departure",
    icon: "clock",
    question: "Departure time flexibility?",
    subtext: "How flexible are you with the departure time?",
    options: [
      { label: "Exact time only", emoji: "⏰" },
      { label: "±30 minutes OK", emoji: "🕐" },
      { label: "Very flexible", emoji: "🌅" },
    ],
  },
  {
    id: "payment",
    icon: "credit-card",
    question: "Payment preference?",
    options: [
      { label: "Card / Stripe", emoji: "💳" },
      { label: "Venmo / Zelle", emoji: "📱" },
      { label: "Cash", emoji: "💵" },
    ],
  },
];

export default function Preferences() {
  const colors = useColors();
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const progress = useSharedValue(1 / QUESTIONS.length);

  const q = QUESTIONS[step];
  const total = QUESTIONS.length;

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as any,
  }));

  function select(option: string) {
    setAnswers((prev) => ({ ...prev, [q.id]: option }));
  }

  function next() {
    if (!answers[q.id]) return;
    if (step < total - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      progress.value = withTiming((nextStep + 1) / total, { duration: 300 });
    } else {
      router.push({ pathname: "/matching", params: tripId ? { tripId } : {} });
    }
  }

  function back() {
    if (step > 0) {
      const prevStep = step - 1;
      setStep(prevStep);
      progress.value = withTiming((prevStep + 1) / total, { duration: 300 });
    } else {
      router.back();
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={back} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>
            {step + 1} of {total}
          </Text>
          <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <Animated.View
            style={[styles.progressFill, progressStyle, { backgroundColor: colors.primary }]}
          />
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.questionHeader}>
            <View style={[styles.questionIcon, { backgroundColor: colors.secondary }]}>
              <Feather name={q.icon as any} size={22} color={colors.primary} />
            </View>
            <Text style={[styles.questionText, { color: colors.foreground }]}>{q.question}</Text>
            {q.subtext && (
              <Text style={[styles.subtext, { color: colors.mutedForeground }]}>{q.subtext}</Text>
            )}
          </View>

          <View style={styles.options}>
            {q.options.map((opt) => {
              const isSelected = answers[q.id] === opt.label;
              return (
                <TouchableOpacity
                  key={opt.label}
                  style={[
                    styles.option,
                    {
                      backgroundColor: isSelected ? colors.secondary : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => select(opt.label)}
                  activeOpacity={0.8}
                >
                  {opt.emoji ? (
                    <Text style={styles.optionEmoji}>{opt.emoji}</Text>
                  ) : null}
                  <Text
                    style={[
                      styles.optionText,
                      { color: isSelected ? colors.primary : colors.foreground },
                      isSelected && { fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                      <Feather name="check" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[
            styles.nextBtn,
            {
              backgroundColor: answers[q.id] ? colors.primary : colors.muted,
            },
          ]}
          onPress={next}
          disabled={!answers[q.id]}
          activeOpacity={0.88}
        >
          <Text
            style={[
              styles.nextBtnText,
              { color: answers[q.id] ? "#fff" : colors.mutedForeground },
            ]}
          >
            {step < total - 1 ? "Continue" : "Find Matches"}
          </Text>
          <Feather
            name="arrow-right"
            size={18}
            color={answers[q.id] ? "#fff" : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, paddingBottom: 28 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  stepLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  skipBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  skipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  progressTrack: { height: 4, borderRadius: 2, marginBottom: 28, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  questionHeader: { gap: 12, marginBottom: 28 },
  questionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  questionText: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5, lineHeight: 30 },
  subtext: { fontSize: 13, fontFamily: "Inter_400Regular" },
  options: { gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 16,
  },
  optionEmoji: { fontSize: 22 },
  optionText: { flex: 1, fontSize: 16, fontFamily: "Inter_500Medium" },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: {
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
  },
  nextBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
