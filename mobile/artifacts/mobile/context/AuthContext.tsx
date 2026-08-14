import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

import { apiClient, ApiError, setSessionExpiredHandler } from "@/lib/api";

export type UserRole = "driver" | "rider" | null;

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  rating: number;
  trips: number;
  isVerified: boolean;
  onboarded: boolean;
  isFoundingMember: boolean;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  bio: string;
  languages: string[];
  emergencyName: string;
  emergencyPhone: string;
  photoUrl: string | null;
  ridePreferences: Record<string, string>;
  preferencesCount: number;
  notificationSettings: NotificationSettings;
  deletionRequestedAt: string | null;
}

export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  tripUpdates: boolean;
  marketing: boolean;
  messages: boolean;
}

export interface OnboardingProfile {
  name: string;
  bio: string;
  languages: string[];
  emergencyName: string;
  emergencyPhone: string;
  photoUrl?: string | null;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  activeRideId: string | null;
  deletionScheduledAt: string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (
    name: string,
    email: string,
    phone: string,
    password: string,
  ) => Promise<void>;
  loginWithOAuth: (input: {
    provider: "google" | "apple";
    idToken: string;
    name?: string;
    email?: string;
  }) => Promise<User>;
  setRole: (role: UserRole) => Promise<void>;
  completeOnboarding: (profile: OnboardingProfile) => Promise<void>;
  patchMe: (patch: Record<string, unknown>) => Promise<void>;
  updateNotificationSettings: (
    settings: Partial<NotificationSettings>,
  ) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  cancelAccountDeletion: () => Promise<void>;
  setActiveRide: (rideId: string | null) => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "@wegotcha/auth_token";
const DELETION_KEY = "@wegotcha/deletion_scheduled";
const ACTIVE_RIDE_KEY = "@wegotcha/active_ride";
/** Last known profile, so a cold start renders instantly instead of blocking. */
const CACHED_USER_KEY = "@wegotcha/cached_user";
const DELETION_GRACE_DAYS = 7;

/**
 * A session is only invalid when the server actually rejects it. Network
 * failures, timeouts and 5xx must never sign the user out — that was the cause
 * of the "logged out every time I open the app" behaviour.
 */
function isAuthRejection(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

function normalizeUser(raw: any): User {
  const ridePreferences =
    raw.ridePreferences && typeof raw.ridePreferences === "object"
      ? (raw.ridePreferences as Record<string, string>)
      : {};
  return {
    id: String(raw.id),
    name: String(raw.name),
    email: String(raw.email),
    phone: String(raw.phone ?? ""),
    role: (raw.role ?? null) as UserRole,
    rating: Number(raw.rating ?? 5),
    trips: Number(raw.trips ?? 0),
    isVerified: Boolean(raw.isVerified),
    onboarded: Boolean(raw.onboarded),
    isFoundingMember: Boolean(raw.isFoundingMember),
    subscriptionStatus:
      typeof raw.subscriptionStatus === "string" && raw.subscriptionStatus
        ? raw.subscriptionStatus
        : null,
    trialEndsAt:
      typeof raw.trialEndsAt === "string" && raw.trialEndsAt
        ? raw.trialEndsAt
        : null,
    bio: String(raw.bio ?? ""),
    languages: Array.isArray(raw.languages)
      ? raw.languages.map(String)
      : [],
    emergencyName: String(raw.emergencyName ?? ""),
    emergencyPhone: String(raw.emergencyPhone ?? ""),
    photoUrl:
      typeof raw.photoUrl === "string" && raw.photoUrl ? raw.photoUrl : null,
    ridePreferences,
    preferencesCount: Number(
      raw.preferencesCount ?? Object.keys(ridePreferences).length,
    ),
    notificationSettings: {
      pushEnabled: raw.notificationSettings?.pushEnabled ?? true,
      emailEnabled: raw.notificationSettings?.emailEnabled ?? true,
      tripUpdates: raw.notificationSettings?.tripUpdates ?? true,
      marketing: raw.notificationSettings?.marketing ?? false,
      messages: raw.notificationSettings?.messages ?? true,
    },
    deletionRequestedAt:
      typeof raw.deletionRequestedAt === "string" && raw.deletionRequestedAt
        ? raw.deletionRequestedAt
        : null,
  };
}

export async function refreshUserFromServer(): Promise<User | null> {
  try {
    const me = await apiClient.get("/auth/me");
    return normalizeUser(me);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [deletionScheduledAt, setDeletionScheduledAt] = useState<string | null>(
    null,
  );

  useEffect(() => {
    loadUser();
  }, []);

  // One place decides what a rejected session means. Any request that comes
  // back 401/403 clears the stored token and drops the user to signed-out,
  // rather than each screen guessing.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      AsyncStorage.multiRemove([TOKEN_KEY, CACHED_USER_KEY, ACTIVE_RIDE_KEY]).catch(
        () => {},
      );
      setUser(null);
      setActiveRideId(null);
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  async function loadUser() {
    try {
      // 7-day grace deletion handling (CCPA)
      const deletionData = await AsyncStorage.getItem(DELETION_KEY);
      if (deletionData) {
        const parsed = JSON.parse(deletionData) as { scheduledAt: string };
        const daysSince =
          (Date.now() - new Date(parsed.scheduledAt).getTime()) /
          (1000 * 60 * 60 * 24);
        if (daysSince >= DELETION_GRACE_DAYS) {
          await AsyncStorage.multiRemove([
            TOKEN_KEY,
            DELETION_KEY,
            ACTIVE_RIDE_KEY,
            CACHED_USER_KEY,
          ]);
          setIsLoading(false);
          return;
        }
        setDeletionScheduledAt(parsed.scheduledAt);
      }

      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        // 1. Show the cached profile immediately — no network wait on launch.
        const cached = await AsyncStorage.getItem(CACHED_USER_KEY);
        if (cached) {
          try {
            setUser(normalizeUser(JSON.parse(cached)));
          } catch {
            await AsyncStorage.removeItem(CACHED_USER_KEY);
          }
        }

        const rideData = await AsyncStorage.getItem(ACTIVE_RIDE_KEY);
        if (rideData) setActiveRideId(rideData);

        // 2. Revalidate against the server, and only sign out if it actually
        //    rejects the session.
        try {
          const me = await apiClient.get("/auth/me");
          setUser(normalizeUser(me));
          await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(me));
        } catch (err) {
          if (isAuthRejection(err)) {
            await AsyncStorage.multiRemove([TOKEN_KEY, CACHED_USER_KEY]);
            setUser(null);
          }
          // Offline or server hiccup: keep the cached session and carry on.
        }
      }
    } catch {}
    setIsLoading(false);
  }

  /** Set the signed-in user and mirror it to the offline cache. */
  function applyUser(next: User) {
    setUser(next);
    AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(next)).catch(() => {});
  }

  function setActiveRide(rideId: string | null) {
    setActiveRideId(rideId);
    if (rideId) {
      AsyncStorage.setItem(ACTIVE_RIDE_KEY, rideId).catch(() => {});
    } else {
      AsyncStorage.removeItem(ACTIVE_RIDE_KEY).catch(() => {});
    }
  }

  async function login(email: string, password: string): Promise<User> {
    const res = await apiClient.post<{ user: unknown; token: string }>(
      "/auth/login",
      { email, password },
    );
    await AsyncStorage.setItem(TOKEN_KEY, res.token);
    const normalized = normalizeUser(res.user);
    applyUser(normalized);
    if (normalized.deletionRequestedAt) {
      setDeletionScheduledAt(normalized.deletionRequestedAt);
      await AsyncStorage.setItem(
        DELETION_KEY,
        JSON.stringify({
          userId: normalized.id,
          scheduledAt: normalized.deletionRequestedAt,
        }),
      );
    }
    return normalized;
  }

  async function register(
    name: string,
    email: string,
    phone: string,
    password: string,
  ) {
    const res = await apiClient.post<{ user: unknown; token: string }>(
      "/auth/register",
      { name, email, phone, password },
    );
    await AsyncStorage.setItem(TOKEN_KEY, res.token);
    applyUser(normalizeUser(res.user));
  }

  async function loginWithOAuth(input: {
    provider: "google" | "apple";
    idToken: string;
    name?: string;
    email?: string;
  }): Promise<User> {
    const res = await apiClient.post<{ user: unknown; token: string }>(
      "/auth/oauth",
      input,
    );
    await AsyncStorage.setItem(TOKEN_KEY, res.token);
    const normalized = normalizeUser(res.user);
    applyUser(normalized);
    return normalized;
  }

  async function updateNotificationSettings(
    settings: Partial<NotificationSettings>,
  ) {
    const res = await apiClient.put<{ user: unknown }>(
      "/auth/me/notifications",
      settings,
    );
    applyUser(normalizeUser(res.user));
  }

  async function patchMe(patch: Record<string, unknown>) {
    const updated = await apiClient.patch("/auth/me", patch);
    applyUser(normalizeUser(updated));
  }

  async function setRole(role: UserRole) {
    if (!user) return;
    await patchMe({ role });
  }

  async function completeOnboarding(profile: OnboardingProfile) {
    if (!user) return;
    await patchMe({
      name: profile.name,
      bio: profile.bio,
      languages: profile.languages,
      emergencyName: profile.emergencyName,
      emergencyPhone: profile.emergencyPhone,
      ...(profile.photoUrl ? { photoUrl: profile.photoUrl } : {}),
      role: profile.role,
      onboarded: true,
    });
  }

  async function logout() {
    try {
      await apiClient.post("/auth/logout", {});
    } catch {}
    await AsyncStorage.multiRemove([TOKEN_KEY, ACTIVE_RIDE_KEY, CACHED_USER_KEY]);
    setUser(null);
    setActiveRideId(null);
  }

  async function refreshMe() {
    const fresh = await refreshUserFromServer();
    if (fresh) {
      applyUser(fresh);
      if (fresh.deletionRequestedAt) {
        setDeletionScheduledAt(fresh.deletionRequestedAt);
        await AsyncStorage.setItem(
          DELETION_KEY,
          JSON.stringify({
            userId: fresh.id,
            scheduledAt: fresh.deletionRequestedAt,
          }),
        );
      } else {
        setDeletionScheduledAt(null);
        await AsyncStorage.removeItem(DELETION_KEY);
      }
    }
  }

  /** CCPA: schedule server-side purge after 7 days and revoke sessions. */
  async function deleteAccount() {
    if (!user) return;
    const res = await apiClient.post<{
      deletionRequestedAt: string;
      purgeAt: string;
    }>("/auth/account/delete", {});
    await AsyncStorage.setItem(
      DELETION_KEY,
      JSON.stringify({
        userId: user.id,
        scheduledAt: res.deletionRequestedAt,
      }),
    );
    setDeletionScheduledAt(res.deletionRequestedAt);
    await AsyncStorage.multiRemove([TOKEN_KEY, ACTIVE_RIDE_KEY, CACHED_USER_KEY]);
    setUser(null);
    setActiveRideId(null);
  }

  async function cancelAccountDeletion() {
    const res = await apiClient.post<{ user: unknown }>(
      "/auth/account/cancel-deletion",
      {},
    );
    await AsyncStorage.removeItem(DELETION_KEY);
    setDeletionScheduledAt(null);
    applyUser(normalizeUser(res.user));
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        activeRideId,
        deletionScheduledAt,
        login,
        register,
        loginWithOAuth,
        setRole,
        completeOnboarding,
        patchMe,
        updateNotificationSettings,
        logout,
        deleteAccount,
        cancelAccountDeletion,
        setActiveRide,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { TOKEN_KEY };
