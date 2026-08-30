/**
 * The retry and session rules in `lib/api.ts`.
 *
 * These exist because both defaults were wrong in a way that reached the user:
 * every POST was retried (so one SOS press could open three Noonlight alarms),
 * and every 403 signed the user out (so tapping a button you were not entitled
 * to ejected you from the app).
 */
import { apiClient, ApiError, setSessionExpiredHandler } from "../api";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  setSessionExpiredHandler(null);
  jest.clearAllMocks();
});

describe("what may be repeated", () => {
  it("retries a GET when the server is failing", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { error: "boom" }))
      .mockResolvedValueOnce(jsonResponse(500, { error: "boom" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await expect(apiClient.get("/trips")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry POST /safety/sos — a repeat dispatches responders twice", async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { error: "boom" }));

    await expect(apiClient.post("/safety/sos", {})).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a POST that times out", async () => {
    // A timeout says we stopped waiting, not that the server did nothing.
    fetchMock.mockRejectedValue(
      Object.assign(new Error("Aborted"), { name: "AbortError" }),
    );

    await expect(apiClient.post("/bookings/prepare", {})).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a POST that explicitly opts in", async () => {
    // /bookings/confirm opts in: it runs after the Sailor has paid, and the
    // server returns the existing booking rather than reserving seats twice.
    fetchMock
      .mockResolvedValueOnce(jsonResponse(500, { error: "boom" }))
      .mockResolvedValueOnce(jsonResponse(200, { booking: { id: "b1" } }));

    await expect(
      apiClient.post("/bookings/confirm", { bookingId: "b1" }, { retry: true }),
    ).resolves.toEqual({ booking: { id: "b1" } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx, even on a GET", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "bad request" }));

    await expect(apiClient.get("/trips")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("what ends the session", () => {
  it("signs the user out on 401", async () => {
    const onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Session expired" }));

    await expect(apiClient.get("/auth/me")).rejects.toBeInstanceOf(ApiError);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("does NOT sign the user out on 403 — that is a business rule", async () => {
    const onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);
    fetchMock.mockResolvedValue(
      jsonResponse(403, { error: "Only the Voyager can delete this group." }),
    );

    await expect(
      apiClient.delete("/groups/g1"),
    ).rejects.toBeInstanceOf(ApiError);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("surfaces the server's error message", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { error: "You can only cancel your own adventures." }),
    );

    await expect(apiClient.delete("/trips/t1")).rejects.toThrow(
      "You can only cancel your own adventures.",
    );
  });
});
