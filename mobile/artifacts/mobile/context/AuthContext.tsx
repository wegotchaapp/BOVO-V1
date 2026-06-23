import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

import { apiClient } from "@/lib/api";

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
  setRole: (role: UserRole) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  setActiveRide: (rideId: string | null) => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "@wegotcha/auth_token";
const DELETION_KEY = "@wegotcha/deletion_scheduled";
const ACTIVE_RIDE_KEY = "@wegotcha/active_ride";
const DELETION_GRACE_DAYS = 7;

function normalizeUser(raw: any): User {
  return {
    id: String(raw.id),
    name: String(raw.name),
    email: String(raw.email),
    phone: String(raw.phone),
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
          ]);
          setIsLoading(false);
          return;
        }
        setDeletionScheduledAt(parsed.scheduledAt);
      }

      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const me = await apiClient.get("/auth/me");
          setUser(normalizeUser(me));
          const rideData = await AsyncStorage.getItem(ACTIVE_RIDE_KEY);
          if (rideData) setActiveRideId(rideData);
        } catch {
          // Token invalid or expired — clear it
          await AsyncStorage.removeItem(TOKEN_KEY);
        }
      }
    } catch {}
    setIsLoading(false);
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
    setUser(normalized);
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
    setUser(normalizeUser(res.user));
  }

  async function patchMe(patch: Record<string, unknown>) {
    const updated = await apiClient.patch("/auth/me", patch);
    setUser(normalizeUser(updated));
  }

  async function setRole(role: UserRole) {
    if (!user) return;
    await patchMe({ role });
  }

  async function completeOnboarding() {
    if (!user) return;
    // `isVerified` is server-gated by a real ID-check flow (placeholder for now).
    await patchMe({ onboarded: true });
  }

  async function logout() {
    try {
      await apiClient.post("/auth/logout", {});
    } catch {}
    await AsyncStorage.multiRemove([TOKEN_KEY, ACTIVE_RIDE_KEY]);
    setUser(null);
    setActiveRideId(null);
  }

  /**
   * Schedules account deletion.
   * Profile data is retained for 7 days (CCPA / regulatory compliance).
   * After 7 days, loadUser() permanently clears the local token on next open.
   * The server retains the user row for now — a server-side purge job can be
   * added later when full data-deletion endpoints are implemented.
   */
  async function refreshMe() {
    const fresh = await refreshUserFromServer();
    if (fresh) setUser(fresh);
  }

  async function deleteAccount() {
    if (!user) return;
    const scheduledAt = new Date().toISOString();
    await AsyncStorage.setItem(
      DELETION_KEY,
      JSON.stringify({ userId: user.id, scheduledAt }),
    );
    setDeletionScheduledAt(scheduledAt);
    await logout();
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
        setRole,
        completeOnboarding,
        logout,
        deleteAccount,
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
