import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { PaymentBody } from "../../app/payment";
import { prepareBooking, confirmBooking } from "@/lib/bookings";
import { getTrip } from "@/lib/trips";
import { useStripe } from "@/lib/stripeNative";
jest.mock("@/lib/trips", () => ({ getTrip: jest.fn() }));
jest.mock("@/lib/bookings", () => ({
  prepareBooking: jest.fn(),
  confirmBooking: jest.fn(),
  computeServiceFee: () => 3,
}));
jest.mock("@/lib/stripeNative", () => ({
  StripeProvider: ({ children }: any) => children,
  useStripe: jest.fn(),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ tripId: "trip-1" }),
}));
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
jest.mock("@/lib/alert", () => ({ Alert: { alert: jest.fn() } }));
jest.mock("@/components/HoldToConfirm", () => ({
  HoldToConfirm: ({ label, onConfirm }: any) =>
    require("react").createElement(require("react-native").Pressable, {
      accessibilityRole: "button",
      accessibilityLabel: label,
      onPress: onConfirm,
    }),
}));
jest.mock("@/components/checkout/CheckoutComplete", () => ({
  CheckoutComplete: ({ booking }: any) =>
    require("react").createElement(
      require("react-native").Text,
      null,
      `Printer for ${booking.id}`,
    ),
}));
it("renders the printer directly in the real payment screen after Stripe and booking confirmation", async () => {
  (getTrip as jest.Mock).mockResolvedValue({
    trip: {
      id: "trip-1",
      pricePerSeat: 42,
      fromCity: "Austin",
      toCity: "Dallas",
      departureAt: "2026-09-21T10:00:00Z",
      driver: { name: "Alex" },
    },
  });
  const init = jest.fn(async () => ({})),
    present = jest.fn(async () => ({}));
  (useStripe as jest.Mock).mockReturnValue({
    initPaymentSheet: init,
    presentPaymentSheet: present,
  });
  (prepareBooking as jest.Mock).mockResolvedValue({
    booking: { id: "booking-1" },
    clientSecret: "test",
  });
  (confirmBooking as jest.Mock).mockResolvedValue({
    id: "booking-1",
    status: "confirmed",
  });
  const ui = await render(<PaymentBody />);
  await waitFor(() =>
    expect(ui.getByRole("button", { name: /Hold to pay/ })).toBeTruthy(),
  );
  expect(ui.queryByText("Printer for booking-1")).toBeNull();
  await act(async () => {
    await fireEvent.press(ui.getByRole("button", { name: /Hold to pay/ }));
  });
  await waitFor(() =>
    expect(ui.getByText("Printer for booking-1")).toBeTruthy(),
  );
  expect(init).toHaveBeenCalledTimes(1);
  expect(present).toHaveBeenCalledTimes(1);
  expect(confirmBooking).toHaveBeenCalledWith("booking-1");
  expect(ui.queryByRole("button", { name: /Hold to pay/ })).toBeNull();
});
