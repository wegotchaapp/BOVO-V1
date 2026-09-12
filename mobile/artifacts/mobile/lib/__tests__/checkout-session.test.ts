import { createCheckoutSession } from "../checkout-session";
import type { Booking } from "../bookings";
const booking = { id: "booking-1", status: "confirmed" } as Booking;
const input = { tripId: "trip-1", seats: 1, paymentMethod: "card" as const };
function setup() {
  const prepare = jest.fn(async () => ({
    booking,
    clientSecret: "test-secret",
    publishableKey: "test-key",
  }));
  const present = jest.fn(async (): Promise<"paid" | "cancelled"> => "paid");
  const confirm = jest.fn(async () => booking);
  return {
    prepare,
    present,
    confirm,
    session: createCheckoutSession({ prepare, present, confirm }),
  };
}
it("retries confirmation without creating or presenting another payment", async () => {
  const test = setup();
  test.confirm.mockRejectedValueOnce(new Error("network unavailable"));
  await expect(test.session.pay(input)).rejects.toThrow("network unavailable");
  expect(test.session.needsConfirmation).toBe(true);
  await expect(test.session.pay(input)).resolves.toEqual(booking);
  expect(test.prepare).toHaveBeenCalledTimes(1);
  expect(test.present).toHaveBeenCalledTimes(1);
  expect(test.confirm.mock.calls).toEqual([["booking-1"], ["booking-1"]]);
});
it("never turns configuration failure into a confirmed booking", async () => {
  const test = setup();
  test.prepare.mockRejectedValueOnce(new Error("payments not configured"));
  await expect(test.session.pay(input)).rejects.toThrow("not configured");
  expect(test.present).not.toHaveBeenCalled();
  expect(test.confirm).not.toHaveBeenCalled();
});
it("does not print a pending booking or re-charge it on retry", async () => {
  const test = setup();
  test.confirm.mockResolvedValueOnce({ ...booking, status: "pending" });
  await expect(test.session.pay(input)).rejects.toThrow("still pending");
  await test.session.pay(input);
  expect(test.prepare).toHaveBeenCalledTimes(1);
});
it("handles cancellation without confirmation", async () => {
  const test = setup();
  test.present.mockResolvedValueOnce("cancelled");
  await expect(test.session.pay(input)).resolves.toBeNull();
  expect(test.confirm).not.toHaveBeenCalled();
});
it("coalesces simultaneous calls and retains completed results", async () => {
  const test = setup();
  await Promise.all([test.session.pay(input), test.session.pay(input)]);
  await test.session.pay(input);
  expect(test.prepare).toHaveBeenCalledTimes(1);
  expect(test.confirm).toHaveBeenCalledTimes(1);
});
