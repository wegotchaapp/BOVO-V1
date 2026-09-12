import { IN_PROGRESS_GRACE_MS, isActivePost } from "../trip-activity";

const NOW = Date.parse("2026-09-11T18:00:00Z");
const HOUR = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe("isActivePost", () => {
  it("keeps a post that hasn't departed", () => {
    expect(isActivePost({ status: "active", departureAt: at(HOUR) }, NOW)).toBe(true);
  });

  it("drops a post whose departure passed without it starting", () => {
    // The reported bug: back-dated posts still listed as active.
    expect(isActivePost({ status: "active", departureAt: at(-HOUR) }, NOW)).toBe(false);
    expect(isActivePost({ status: "active", departureAt: at(-5 * 24 * HOUR) }, NOW)).toBe(false);
  });

  it("keeps a started ride while it could still be on the road", () => {
    expect(isActivePost({ status: "in_progress", departureAt: at(-3 * HOUR) }, NOW)).toBe(true);
  });

  it("drops a started ride left open long after it would have arrived", () => {
    expect(
      isActivePost({ status: "in_progress", departureAt: at(-IN_PROGRESS_GRACE_MS - HOUR) }, NOW),
    ).toBe(false);
  });

  it("never counts cancelled or completed posts", () => {
    expect(isActivePost({ status: "cancelled", departureAt: at(HOUR) }, NOW)).toBe(false);
    expect(isActivePost({ status: "completed", departureAt: at(HOUR) }, NOW)).toBe(false);
  });

  it("treats an unreadable departure as not active", () => {
    expect(isActivePost({ status: "active", departureAt: "not a date" }, NOW)).toBe(false);
  });
});
