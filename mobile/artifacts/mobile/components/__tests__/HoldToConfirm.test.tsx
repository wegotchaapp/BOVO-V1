import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { HoldToConfirm } from "../HoldToConfirm";
// Instant visual completion proves authorization uses the timer, not animation callbacks.
jest.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: { View: require("react-native").View },
  useSharedValue: (value: number) => require("react").useRef({ value }).current,
  useAnimatedStyle: () => ({}),
  withTiming: (value: number) => value,
  cancelAnimation: jest.fn(),
  Easing: { linear: (value: number) => value },
}));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    primary: "#123",
    secondary: "#eee",
    destructive: "#c00",
    mutedForeground: "#666",
  }),
}));
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
it("does not authorize a short press, even if animations complete immediately", async () => {
  const confirm = jest.fn();
  const ui = await render(<HoldToConfirm label="Pay" onConfirm={confirm} />);
  await fireEvent(ui.getByRole("button"), "pressIn");
  await act(async () => jest.advanceTimersByTime(1599));
  expect(confirm).not.toHaveBeenCalled();
  await fireEvent(ui.getByRole("button"), "pressOut");
  await act(async () => jest.advanceTimersByTime(2000));
  expect(confirm).not.toHaveBeenCalled();
});
it("confirms exactly once after a full uninterrupted hold", async () => {
  const confirm = jest.fn();
  const ui = await render(<HoldToConfirm label="Pay" onConfirm={confirm} />);
  await fireEvent(ui.getByRole("button"), "pressIn");
  await act(async () => jest.advanceTimersByTime(1600));
  await fireEvent(ui.getByRole("button"), "pressOut");
  await act(async () => jest.advanceTimersByTime(3000));
  expect(confirm).toHaveBeenCalledTimes(1);
});
it("cancels a hold when disabled mid-gesture", async () => {
  const confirm = jest.fn();
  const ui = await render(<HoldToConfirm label="Pay" onConfirm={confirm} />);
  await fireEvent(ui.getByRole("button"), "pressIn");
  await act(async () => jest.advanceTimersByTime(900));
  await ui.rerender(<HoldToConfirm label="Pay" onConfirm={confirm} disabled />);
  await act(async () => jest.advanceTimersByTime(2000));
  expect(confirm).not.toHaveBeenCalled();
});
it("cancels on unmount and focus loss", async () => {
  const confirm = jest.fn();
  const ui = await render(<HoldToConfirm label="Pay" onConfirm={confirm} />);
  await fireEvent(ui.getByRole("button"), "pressIn");
  await fireEvent(ui.getByRole("button"), "blur");
  await act(async () => jest.advanceTimersByTime(1700));
  expect(confirm).not.toHaveBeenCalled();
  await fireEvent(ui.getByRole("button"), "pressIn");
  await ui.unmount();
  await act(async () => jest.advanceTimersByTime(2000));
  expect(confirm).not.toHaveBeenCalled();
});
