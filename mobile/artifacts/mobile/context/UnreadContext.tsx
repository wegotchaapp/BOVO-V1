import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { apiClient } from "@/lib/api";
import { useAuth } from "./AuthContext";

interface UnreadTripReply {
  tripId: string;
  unreadCount: number;
}

interface UnreadContextValue {
  tripUnreads: Record<string, number>;
  totalUnread: number;
  markTripRead: (tripId: string) => void;
  refresh: () => void;
}

const UnreadContext = createContext<UnreadContextValue>({
  tripUnreads: {},
  totalUnread: 0,
  markTripRead: () => {},
  refresh: () => {},
});

const POLL_INTERVAL_MS = 30_000;

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tripUnreads, setTripUnreads] = useState<Record<string, number>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    try {
      const data = await apiClient.get<{
        unreadTripReplies: UnreadTripReply[];
        totalUnread: number;
      }>("/notifications/unread");
      if (!isMountedRef.current) return;
      const map: Record<string, number> = {};
      for (const item of data.unreadTripReplies) {
        map[item.tripId] = item.unreadCount;
      }
      setTripUnreads(map);
    } catch {
      // Fail silently — notifications are best-effort
    }
  }, [user]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    fetchUnread();
    intervalRef.current = setInterval(fetchUnread, POLL_INTERVAL_MS);
  }, [fetchUnread, stopPolling]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!user) {
      setTripUnreads({});
      stopPolling();
      return;
    }
    startPolling();

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") startPolling();
      else stopPolling();
    });

    return () => {
      isMountedRef.current = false;
      stopPolling();
      sub.remove();
    };
  }, [user, startPolling, stopPolling]);

  const markTripRead = useCallback((tripId: string) => {
    // Optimistically clear unread for instant UI response.
    setTripUnreads((prev) => {
      if (!prev[tripId]) return prev;
      const next = { ...prev };
      delete next[tripId];
      return next;
    });
    // Persist to server (fire and forget).
    apiClient.post(`/trips/${tripId}/mark-read`).catch(() => {});
  }, []);

  const totalUnread = Object.values(tripUnreads).reduce((s, n) => s + n, 0);

  return (
    <UnreadContext.Provider
      value={{ tripUnreads, totalUnread, markTripRead, refresh: fetchUnread }}
    >
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread(): UnreadContextValue {
  return useContext(UnreadContext);
}
