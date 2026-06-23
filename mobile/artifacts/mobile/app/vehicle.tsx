import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

const MAKES = ["Toyota", "Honda", "Ford", "Chevrolet", "Tesla", "Hyundai", "Kia", "Nissan", "Jeep", "Subaru"];
const COLORS_LIST = ["White", "Black", "Silver", "Gray", "Red", "Blue", "Green", "Brown", "Orange", "Yellow"];
const YEARS = Array.from({ length: 15 }, (_, i) => String(2025 - i));

export default function Vehicle() {
  const colors = useColors();
  const router = useRouter();

  const [make, setMake] = useState("Toyota");
  const [model, setModel] = useState("Camry");
  const [year, setYear] = useState("2022");
  const [color, setColor] = useState("White");
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (!plate.trim()) {
      Alert.alert("Required", "Please enter your license plate number.");
      return;
    }
    setSaved(true);
    Alert.alert("Vehicle Saved", "Your vehicle has been registered successfully.", [
      { text: "Done", onPress: () => router.back() },
    ]);
  }

  function renderPickerRow(label: string, value: string, options: string[], onSelect: (v: string) => void) {
    return (
      <View style={styles.fieldBlock}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.chip,
                {
                  backgroundColor: value === opt ? colors.primary : colors.muted,
                  borderColor: value === opt ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onSelect(opt)}
            >
              <Text style={[styles.chipText, { color: value === opt ? "#fff" : colors.foreground }]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Vehicle</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={[styles.saveLink, { color: colors.primary }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, CARD_SHADOW]}>
          <View style={styles.vehicleIconRow}>
            <View style={[styles.vehicleIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="truck" size={32} color={colors.primary} />
            </View>
            {saved && (
              <View style={[styles.approvedBadge, { backgroundColor: "#ECFDF5" }]}>
                <Feather name="check-circle" size={14} color="#059669" />
                <Text style={[styles.approvedText, { color: "#059669" }]}>Registered</Text>
              </View>
            )}
          </View>

          {renderPickerRow("Make", make, MAKES, setMake)}
          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Model</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground }]}
              value={model}
              onChangeText={setModel}
              placeholder="e.g. Camry, Civic, F-150"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
          {renderPickerRow("Year", year, YEARS, setYear)}
          {renderPickerRow("Color", color, COLORS_LIST, setColor)}

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>License Plate *</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground }]}
              value={plate}
              onChangeText={(t) => setPlate(t.toUpperCase())}
              placeholder="e.g. ABC-1234"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>VIN (optional)</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground }]}
              value={vin}
              onChangeText={setVin}
              placeholder="17-character VIN"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              maxLength={17}
            />
          </View>
        </View>

        <View style={[styles.card, CARD_SHADOW]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Documents</Text>
          {[
            { icon: "camera", label: "Vehicle Photos", sub: "Min. 3 photos (front, back, interior)", done: false },
            { icon: "file-text", label: "Insurance Certificate", sub: "Valid auto insurance document", done: false },
            { icon: "shield", label: "Registration Card", sub: "Current Texas vehicle registration", done: false },
          ].map((doc) => (
            <TouchableOpacity
              key={doc.label}
              style={[styles.docRow, { borderBottomColor: colors.border }]}
              onPress={() => Alert.alert(doc.label, "Document upload will be available at launch.")}
              activeOpacity={0.75}
            >
              <View style={[styles.docIcon, { backgroundColor: colors.secondary }]}>
                <Feather name={doc.icon as any} size={16} color={colors.primary} />
              </View>
              <View style={styles.docText}>
                <Text style={[styles.docTitle, { color: colors.foreground }]}>{doc.label}</Text>
                <Text style={[styles.docSub, { color: colors.mutedForeground }]}>{doc.sub}</Text>
              </View>
              <Feather name={doc.done ? "check-circle" : "upload"} size={18} color={doc.done ? "#059669" : colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
          <Feather name="info" size={14} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.primary }]}>
            Bovogo verifies vehicle details before your first trip. Average review time: 24 hours.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          activeOpacity={0.88}
        >
          <Feather name="save" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>Save Vehicle</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  saveLink: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 20, gap: 16 },
  vehicleIconRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  vehicleIcon: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  approvedBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  approvedText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  fieldBlock: { gap: 10 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3, textTransform: "uppercase" },
  chipScroll: { gap: 8, paddingRight: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  textInput: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  docIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  docText: { flex: 1, gap: 3 },
  docTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  docSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 14, borderRadius: 14 },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  saveBtn: {
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
