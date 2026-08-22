import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { showAlert, showSuccess } from "@/lib/alert";
import { startTrip, uploadStartVideo } from "@/lib/trips";

const MAX_DURATION_S = 30;

/**
 * Mandatory pre-trip vehicle video. The Voyager must record a short clip of
 * their car with the live camera before the ride can start. There is
 * intentionally no gallery picker: the recording must come from the camera.
 */
export default function PreTripVideoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [permissionsReady, setPermissionsReady] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.play();
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Request camera + mic before mounting CameraView (native only).
  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    (async () => {
      const cam = await requestCameraPermission();
      const mic = await requestMicPermission();
      if (!cancelled) {
        setPermissionsReady(Boolean(cam?.granted && mic?.granted));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startRecording() {
    if (!cameraRef.current || recording) return;
    if (!cameraReady) {
      await showAlert(
        "Camera starting",
        "The camera is still preparing. Wait a moment and try again.",
      );
      return;
    }
    setRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: MAX_DURATION_S,
      });
      if (result?.uri) setVideoUri(result.uri);
    } catch (err: any) {
      await showAlert("Recording failed", err?.message || "Please try again.");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      setElapsed(0);
    }
  }

  function stopRecording() {
    cameraRef.current?.stopRecording();
  }

  function retake() {
    setVideoUri(null);
  }

  async function submit() {
    if (!videoUri || !tripId) return;
    setUploading(true);
    try {
      await uploadStartVideo(tripId, videoUri);
      await startTrip(tripId);
      await showSuccess(
        "Adventure Started!",
        "Your vehicle video is saved and the adventure is underway. Log each Sailor's odometer reading as you pick them up. Safe travels!",
        // Straight to the manifest — the odometer log is the Voyager's main job
        // during the drive.
        () =>
          router.replace({ pathname: "/manifest/[tripId]", params: { tripId } }),
      );
    } catch (err: any) {
      await showAlert("Couldn't start the adventure", err?.message || "Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // Web cannot record video with expo-camera.
  if (Platform.OS === "web") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 32 }]}>
        <Feather name="smartphone" size={40} color={colors.mutedForeground} />
        <Text style={[styles.permissionTitle, { color: colors.foreground }]}>
          Mobile app required
        </Text>
        <Text style={[styles.permissionText, { color: colors.mutedForeground }]}>
          Car video recording requires the Bovogo app on a real device. Open this
          screen in Expo Go or a development build on your phone — it cannot be
          recorded from the web browser.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const permissionDenied =
    (cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain) ||
    (micPermission && !micPermission.granted && !micPermission.canAskAgain);

  if (!cameraPermission || !micPermission || !permissionsReady) {
    if (permissionDenied) {
      return (
        <View style={[styles.center, { backgroundColor: colors.background, padding: 32 }]}>
          <Feather name="camera-off" size={40} color={colors.mutedForeground} />
          <Text style={[styles.permissionTitle, { color: colors.foreground }]}>
            Camera access needed
          </Text>
          <Text style={[styles.permissionText, { color: colors.mutedForeground }]}>
            Recording a live video of your car is required before every ride. Please
            enable camera and microphone access in your device settings.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={[styles.center, { backgroundColor: "#000" }]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={[styles.recordLabel, { marginTop: 12 }]}>
          Requesting camera access…
        </Text>
      </View>
    );
  }

  // ─── Preview after recording ───────────────────────────────────────────────
  if (videoUri) {
    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.topBarTitle}>Review your video</Text>
        </View>
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
          {uploading ? (
            <View style={styles.uploadingWrap}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.uploadingText}>Uploading video…</Text>
            </View>
          ) : (
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={retake} activeOpacity={0.85}>
                <Feather name="rotate-ccw" size={16} color="#fff" />
                <Text style={styles.secondaryBtnText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: "#1A5C38", flex: 1 }]}
                onPress={submit}
                activeOpacity={0.85}
              >
                <Feather name="check" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Use Video & Start Adventure</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ─── Live camera ───────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        mode="video"
        onCameraReady={() => setCameraReady(true)}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          disabled={recording}
        >
          <Feather name="x" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>
          {recording ? `Recording ${elapsed}s / ${MAX_DURATION_S}s` : "Record your car"}
        </Text>
        <View style={styles.closeBtn} />
      </View>

      {!recording && (
        <View style={styles.hintWrap}>
          <Text style={styles.hintText}>
            Walk around your vehicle so the exterior and license plate are visible.
            This video is required before every ride and can't be chosen from your
            gallery.
          </Text>
        </View>
      )}

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          style={[styles.recordBtn, recording && styles.recordBtnActive]}
          onPress={recording ? stopRecording : startRecording}
          activeOpacity={0.8}
        >
          <View style={recording ? styles.stopSquare : styles.recordDot} />
        </TouchableOpacity>
        <Text style={styles.recordLabel}>
          {recording
            ? "Tap to stop"
            : cameraReady
              ? "Tap to record"
              : "Preparing camera…"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    zIndex: 10,
  },
  topBarTitle: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  hintWrap: {
    position: "absolute",
    top: "18%",
    left: 24,
    right: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 14,
    padding: 14,
  },
  hintText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    textAlign: "center",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  recordBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  recordBtnActive: { borderColor: "#DC2626" },
  recordDot: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#DC2626",
  },
  stopSquare: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#DC2626",
  },
  recordLabel: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  uploadingWrap: { alignItems: "center", gap: 10 },
  uploadingText: { color: "#fff", fontSize: 14, fontFamily: "Inter_500Medium" },
  previewActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  secondaryBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
  },
  primaryBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  permissionTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 6 },
  permissionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
