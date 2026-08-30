import { useCallback, useEffect, useRef, useState } from "react";

/**
 * What the screen should render. Deriving this in one place is the point of the
 * hook: `loading`, `failed` and `empty` are three different things, and every
 * time two of them have been collapsed into one the app has told the user to
 * fix something they cannot fix.
 *
 * The matching screen rendered "Set your preferences" when `getTrip` failed, so
 * setting them changed nothing. The Voyager tab rendered "No adventures posted
 * yet" on a failed request, which invites a duplicate post. Search did the same
 * with an empty result.
 */
export type AsyncPhase = "loading" | "failed" | "empty" | "ready";

export interface AsyncResource<T> {
  phase: AsyncPhase;
  data: T | null;
  /**
   * Set whenever the most recent attempt failed, *including* when stale data is
   * still on screen. Check `phase` to decide what to render; check `error` to
   * decide whether to also show a "couldn't refresh" banner over it.
   */
  error: Error | null;
  /** A refresh is in flight over data that is already on screen. */
  refreshing: boolean;
  /** Re-run from scratch. Returns to `loading` and blanks the screen. */
  reload: () => Promise<void>;
  /** Re-run in the background, keeping what is on screen. For pull-to-refresh. */
  refresh: () => Promise<void>;
}

export interface AsyncResourceOptions<T> {
  /** Re-runs the fetch when any of these change, like `useEffect`. */
  deps?: readonly unknown[];
  /**
   * What counts as "nothing to show". Defaults to an empty array or a nullish
   * value; anything else is never empty. Pass your own when emptiness is a
   * property of the shape rather than of the container.
   */
  isEmpty?: (data: T) => boolean;
  /** Skip fetching entirely — for a screen still waiting on a route param. */
  enabled?: boolean;
}

function defaultIsEmpty(data: unknown): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  return false;
}

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Something went wrong");
}

/**
 * Runs an async fetch and reports it as exactly one of four phases.
 *
 * ```ts
 * const trips = useAsyncResource(() => listTrips({ from, to }), {
 *   deps: [from, to],
 * });
 *
 * if (trips.phase === "loading") return <Spinner />;
 * if (trips.phase === "failed") return <Retry onPress={trips.reload} />;
 * if (trips.phase === "empty") return <NoAdventures />;
 * return <List rows={trips.data} onRefresh={trips.refresh} />;
 * ```
 *
 * The fetcher is held in a ref, so an inline arrow is safe — only `deps`
 * re-triggers it. To refetch when a screen regains focus:
 *
 * ```ts
 * useFocusEffect(useCallback(() => { void trips.refresh(); }, [trips.refresh]));
 * ```
 */
export function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  options?: AsyncResourceOptions<T>,
): AsyncResource<T> {
  const { deps = [], isEmpty = defaultIsEmpty, enabled = true } = options ?? {};

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);

  // Held in a ref so callers can pass an inline arrow without re-triggering.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Only the newest request may write state. Without this, a slow first request
  // resolving after a fast second one would overwrite fresh data with stale.
  const requestId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (mode: "reload" | "refresh") => {
      if (!enabled) return;
      const id = ++requestId.current;

      if (mode === "reload") {
        setLoading(true);
        setError(null);
        setData(null);
      } else {
        setRefreshing(true);
      }

      try {
        const result = await fetcherRef.current();
        if (!mounted.current || id !== requestId.current) return;
        setData(result);
        setError(null);
      } catch (err) {
        if (!mounted.current || id !== requestId.current) return;
        // A failed refresh keeps whatever is on screen; only the error is new.
        setError(toError(err));
      } finally {
        if (mounted.current && id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [enabled],
  );

  const reload = useCallback(() => run("reload"), [run]);
  const refresh = useCallback(() => run("refresh"), [run]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void run("reload");
    // `run` is stable per `enabled`; `deps` is the caller's re-fetch trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  let phase: AsyncPhase;
  if (data !== null) {
    // Data wins over a failed refresh: something real is still on screen.
    phase = isEmpty(data) ? "empty" : "ready";
  } else if (error !== null) {
    phase = "failed";
  } else if (loading) {
    phase = "loading";
  } else {
    // Not started, or disabled. Nothing fetched and nothing broken.
    phase = enabled ? "loading" : "empty";
  }

  return { phase, data, error, refreshing, reload, refresh };
}
