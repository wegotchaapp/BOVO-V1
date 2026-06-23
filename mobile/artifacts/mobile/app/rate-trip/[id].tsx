import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { CARD_SHADOW } from "@/constants/colors";
import { useColors } from "@/hooks/useColors";

const TAGS = [
  { id: "clean", label: "Clean Car", icon: "star" },
  { id: "punctual", label: "On Time", icon: "clock" },
  { id: "friendly", label: "Friendly", icon: "smile" },
  { id: "safe", label: "Safe Driver", icon: "shield" },
  { id: "music", label: "Great Music", icon: "music" },
  { id: "quiet", label: "Respectful", icon: "volume-x" },
  { id: "smooth", label: "Smooth Ride", icon: "navigation" },
  { id: "comfy", label: "Comfortable", icon: "thumbs-up" },
];

export default function RateTrip() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [review, setReview] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function toggleTag(id: string) {
    setSelectedTags((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  }

  function handleSubmit() {
    if (rating === 0) {
      Alert.alert("Rate Your Adventure", "Please select a star rating first.");
      return;
    }
    setSubmitted(true);
    setTimeout(() => {
      Alert.alert("Thank You!", "Your review helps build trust in the Bovogo community.", [
        { text: "Done", onPress: () => router.replace("/(tabs)/trips") },
      ]);
    }, 600);
  }

  const displayRating = hovered || rating;
  const ratingLabels = ["", "Poor", "Fair", "Good", "Great", "Amazing!"];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Rate Your Adventure</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.driverCard, CARD_SHADOW]}>
          <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>JD</Text>
          </View>
          <View style={styles.driverInfo}>
            <Text style={[styles.driverName, { color: colors.foreground }]}>John D.</Text>
            <Text style={[styles.tripInfo, { color: colors.mutedForeground }]}>Dallas → Austin · May 24</Text>
          </View>
          <View style={[styles.prevRating, { backgroundColor: colors.secondary }]}>
            <Feather name="star" size={12} color={colors.primary} />
            <Text style={[styles.prevRatingText, { color: colors.primary }]}>4.8</Text>
          </View>
        </View>

        <View style={[styles.card, CARD_SHADOW]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>How was your ride?</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                onPressIn={() => setHovered(star)}
                onPressOut={() => setHovered(0)}
                hitSlop={8}
              >
                <Feather
                  name={star <= displayRating ? "star" : "star"}
                  size={44}
                  color={star <= displayRating ? "#C4954A" : colors.muted}
                />
              </TouchableOpacity>
            ))}
          </View>
          {displayRating > 0 && (
            <Text style={[styles.ratingLabel, { color: colors.accent }]}>
              {ratingLabels[displayRating]}
            </Text>
          )}
        </View>

        <View style={[styles.card, CARD_SHADOW]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>What stood out?</Text>
          <View style={styles.tagsGrid}>
            {TAGS.map((tag) => {
              const selected = selectedTags.includes(tag.id);
              return (
                <TouchableOpacity
                  key={tag.id}
                  style={[
                    styles.tagChip,
                    {
                      backgroundColor: selected ? colors.secondary : colors.muted,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => toggleTag(tag.id)}
                >
                  <Feather name={tag.icon as any} size={13} color={selected ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.tagText, { color: selected ? colors.primary : colors.foreground }]}>{tag.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, CARD_SHADOW]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Leave a Review</Text>
          <TextInput
            style={[styles.reviewInput, { backgroundColor: colors.muted, color: colors.foreground }]}
            placeholder="Share your experience to help the community..."
            placeholderTextColor={colors.mutedForeground}
            value={review}
            onChangeText={setReview}
            multiline
            numberOfLines={4}
            maxLength={400}
          />
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{review.length}/400</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: submitted ? colors.success : colors.primary },
          ]}
          onPress={handleSubmit}
          activeOpacity={0.88}
          disabled={submitted}
        >
          <Feather name={submitted ? "check" : "send"} size={18} color="#fff" />
          <Text style={styles.submitBtnText}>{submitted ? "Submitted!" : "Submit Review"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/(tabs)/trips")} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  driverCard: { backgroundColor: "#fff", borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  driverInfo: { flex: 1, gap: 4 },
  driverName: { fontSize: 17, fontFamily: "Inter_700Bold" },
  tripInfo: { fontSize: 13, fontFamily: "Inter_400Regular" },
  prevRating: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  prevRatingText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 20, gap: 16 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  starsRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10 },
  ratingLabel: { textAlign: "center", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  tagsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tagChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  tagText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  reviewInput: { borderRadius: 14, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 100, textAlignVertical: "top" },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },
  submitBtn: { height: 56, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  submitBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  skipBtn: { alignItems: "center", paddingVertical: 8 },
  skipText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
