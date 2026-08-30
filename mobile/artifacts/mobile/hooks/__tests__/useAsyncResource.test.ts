/**
 * The four phases, and the one rule that matters: a failed fetch must never
 * render as an empty result. Three screens had collapsed those two states,
 * telling the Sailor to fix something that was not broken on their side.
 */
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { useAsyncResource } from "../useAsyncResource";

const flush = () => new Promise((r) => setTimeout(r, 0));

/** A promise whose settlement this test controls, so intermediate phases are observable. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("phases", () => {
  it("starts loading, then reports ready with the data", async () => {
    const d = deferred<string[]>();
    const { result } = await renderHook(() =>
      useAsyncResource(() => d.promise),
    );

    // Still in flight, so nothing may claim the result is empty yet.
    expect(result.current.phase).toBe("loading");
    expect(result.current.data).toBeNull();

    await act(async () => {
      d.resolve(["a", "b"]);
      await flush();
    });

    expect(result.current.phase).toBe("ready");
    expect(result.current.data).toEqual(["a", "b"]);
    expect(result.current.error).toBeNull();
  });

  it("reports empty for an empty array", async () => {
    const { result } = await renderHook(() => useAsyncResource(async () => []));

    await waitFor(() => expect(result.current.phase).toBe("empty"));
    expect(result.current.error).toBeNull();
  });

  it("reports FAILED, never empty, when the fetch rejects", async () => {
    // The bug this hook exists to prevent: matching.tsx rendered "Set your
    // preferences" here, so setting them changed nothing.
    const { result } = await renderHook(() =>
      useAsyncResource(async () => {
        throw new Error("Network request failed");
      }),
    );

    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.phase).not.toBe("empty");
    expect(result.current.error?.message).toBe("Network request failed");
    expect(result.current.data).toBeNull();
  });

  it("honours a caller's own definition of empty", async () => {
    const { result } = await renderHook(() =>
      useAsyncResource(async () => ({ preferences: {} }), {
        isEmpty: (d) => Object.keys(d.preferences).length === 0,
      }),
    );

    await waitFor(() => expect(result.current.phase).toBe("empty"));
  });

  it("does not fetch while disabled", async () => {
    const fetcher = jest.fn(async () => ["a"]);
    const { result } = await renderHook(() =>
      useAsyncResource(fetcher, { enabled: false }),
    );

    await flush();
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("empty");
  });
});

describe("refreshing", () => {
  it("keeps what is on screen while refreshing", async () => {
    let batch = ["first"];
    const { result } = await renderHook(() => useAsyncResource(async () => batch));

    await waitFor(() => expect(result.current.phase).toBe("ready"));

    batch = ["second"];
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.phase).toBe("ready");
    expect(result.current.data).toEqual(["second"]);
    expect(result.current.refreshing).toBe(false);
  });

  it("keeps the data when a refresh fails, and surfaces the error alongside", async () => {
    let shouldFail = false;
    const { result } = await renderHook(() =>
      useAsyncResource(async () => {
        if (shouldFail) throw new Error("offline");
        return ["kept"];
      }),
    );

    await waitFor(() => expect(result.current.phase).toBe("ready"));

    shouldFail = true;
    await act(async () => {
      await result.current.refresh();
    });

    // Still showing real data, so the phase must not flip to failed — but the
    // caller needs the error to put a "couldn't refresh" banner over it.
    expect(result.current.phase).toBe("ready");
    expect(result.current.data).toEqual(["kept"]);
    expect(result.current.error?.message).toBe("offline");
  });

  it("blanks the screen on an explicit reload, unlike refresh", async () => {
    const pending: Array<ReturnType<typeof deferred<string[]>>> = [];
    const { result } = await renderHook(() =>
      useAsyncResource(() => {
        const d = deferred<string[]>();
        pending.push(d);
        return d.promise;
      }),
    );

    await act(async () => {
      pending[0].resolve(["x"]);
      await flush();
    });
    expect(result.current.phase).toBe("ready");

    await act(async () => {
      void result.current.reload();
      await flush();
    });
    // reload blanks deliberately; refresh would have kept ["x"] on screen.
    expect(result.current.phase).toBe("loading");
    expect(result.current.data).toBeNull();

    await act(async () => {
      pending[1].resolve(["y"]);
      await flush();
    });
    expect(result.current.data).toEqual(["y"]);
  });
});

describe("races", () => {
  it("a slow earlier request cannot overwrite a newer result", async () => {
    const pending: Array<ReturnType<typeof deferred<string[]>>> = [];
    const { result } = await renderHook(() =>
      useAsyncResource(() => {
        const d = deferred<string[]>();
        pending.push(d);
        return d.promise;
      }),
    );

    // Second request supersedes the first before either resolves.
    await act(async () => {
      void result.current.reload();
      await flush();
    });
    expect(pending).toHaveLength(2);

    await act(async () => {
      pending[1].resolve(["newer"]);
      await flush();
      pending[0].resolve(["older"]);
      await flush();
    });

    expect(result.current.data).toEqual(["newer"]);
  });
});
